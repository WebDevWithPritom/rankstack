import { NextRequest, NextResponse } from 'next/server';
import { syncGSCRankings } from '@/lib/gsc';
import { bustDashboardCache } from '@/lib/dashboard-cache';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, mode, days } = body;

    if (!projectId || !mode) {
      return NextResponse.json({ error: 'Project ID and Mode are required' }, { status: 400 });
    }

    // GSC data is lagged by 2 days
    const end = new Date();
    end.setDate(end.getDate() - 2);
    const endDateStr = end.toISOString().split('T')[0];

    let startDays = 7;
    if (mode === '24h' || days === 1) {
      startDays = 1;
    } else if (mode === '90d' || days === 90) {
      startDays = 90;
    } else if (days) {
      startDays = parseInt(days, 10);
    }

    const start = new Date(end);
    start.setDate(start.getDate() - (startDays - 1));
    const startDateStr = start.toISOString().split('T')[0];

    // Run the sync (await it to return direct feedback)
    await syncGSCRankings(projectId, startDateStr, endDateStr, mode);
    // Invalidate any cached dashboard responses for this project
    bustDashboardCache(projectId);

    return NextResponse.json({
      success: true,
      message: `Sync completed successfully for mode: ${mode} (${startDateStr} to ${endDateStr})`
    });
  } catch (error: any) {
    console.error('API sync/gsc failed:', error);
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
