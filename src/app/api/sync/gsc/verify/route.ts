import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import * as store from '@/lib/store';
import { getGSCAccessToken } from '@/lib/gsc';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const daysParam = searchParams.get('days') || '28';
    const days = parseInt(daysParam, 10);

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const project = await store.getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // GSC lag is 2 days
    const end = new Date();
    end.setDate(end.getDate() - 2);
    const endDateStr = end.toISOString().split('T')[0];

    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    const startDateStr = start.toISOString().split('T')[0];

    // 1. Fetch property level totals from GSC (group only by date)
    const accessToken = await getGSCAccessToken(projectId);
    
    let gscClicks = 0;
    let gscImpressions = 0;

    if (accessToken === 'mock_access_token_demo') {
      // Mock GSC response for demo project using seeded property totals
      const dbPropTotals = await store.getPropertyTotals(projectId);
      const rangePropTotals = dbPropTotals.filter(t => t.date >= startDateStr && t.date <= endDateStr);
      gscClicks = rangePropTotals.reduce((sum, t) => sum + t.clicks, 0);
      gscImpressions = rangePropTotals.reduce((sum, t) => sum + t.impressions, 0);
    } else {
      const encodedSite = encodeURIComponent(project.domain);
      const gscUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`;

      const gscResponse = await fetch(gscUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate: startDateStr,
          endDate: endDateStr,
          dimensions: ['date'],
          rowLimit: 1000
        })
      });

      if (!gscResponse.ok) {
        const errText = await gscResponse.text();
        throw new Error(`GSC API returned error: ${gscResponse.status} - ${errText}`);
      }

      const gscData = await gscResponse.json();
      const gscRows: Array<{ clicks: number; impressions: number }> = gscData.rows || [];

      gscClicks = gscRows.reduce((sum, r) => sum + r.clicks, 0);
      gscImpressions = gscRows.reduce((sum, r) => sum + r.impressions, 0);
    }

    // 2. Fetch sum of stored rankings for the same date range
    const rangeRankings = await store.getRankingsInRange(projectId, startDateStr, endDateStr);

    const dbClicks = rangeRankings.reduce((sum, r) => sum + r.clicks, 0);
    const dbImpressions = rangeRankings.reduce((sum, r) => sum + r.impressions, 0);

    // Fetch our stored property totals for the same date range
    const dbPropTotals = await store.getPropertyTotals(projectId);
    const rangePropTotals = dbPropTotals.filter(t => t.date >= startDateStr && t.date <= endDateStr);
    const dbStoredPropertyClicks = rangePropTotals.reduce((sum, t) => sum + t.clicks, 0);
    const dbStoredPropertyImpressions = rangePropTotals.reduce((sum, t) => sum + t.impressions, 0);

    // 3. Compute discrepancies
    const diffClicks = Math.abs(gscClicks - dbClicks);
    const diffClicksPercent = gscClicks > 0 ? (diffClicks / gscClicks) * 100 : 0;

    const diffImpressions = Math.abs(gscImpressions - dbImpressions);
    const diffImpressionsPercent = gscImpressions > 0 ? (diffImpressions / gscImpressions) * 100 : 0;

    const isWithinTolerance = diffClicksPercent <= 2.0 && diffImpressionsPercent <= 2.0;

    return NextResponse.json({
      startDate: startDateStr,
      endDate: endDateStr,
      gscClicks,
      gscImpressions,
      dbClicks,
      dbImpressions,
      dbStoredPropertyClicks,
      dbStoredPropertyImpressions,
      diffClicksPercent: Math.round(diffClicksPercent * 100) / 100,
      diffImpressionsPercent: Math.round(diffImpressionsPercent * 100) / 100,
      isWithinTolerance
    });

  } catch (error: any) {
    console.error('Verify GSC vs Local DB failed:', error);
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
