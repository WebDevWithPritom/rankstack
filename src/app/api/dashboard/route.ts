import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
import * as store from '@/lib/store';
import { Ranking, KeywordRollup, Annotation } from '@/lib/types';
import { GOOGLE_UPDATES, GoogleUpdateEvent } from '@/lib/google-updates-data';
import { getDashboardCache, setDashboardCache } from '@/lib/dashboard-cache';


// Helper to check if a query matches filter rules
function matchesFilter(val: string, filter: string, filterType: string): boolean {
  if (!filter) return true;
  const valLower = val.toLowerCase();
  const filterLower = filter.toLowerCase();

  if (filterType === 'contains') {
    return valLower.includes(filterLower);
  } else if (filterType === 'notContains') {
    return !valLower.includes(filterLower);
  } else if (filterType === 'exact') {
    return valLower === filterLower;
  } else if (filterType === 'regex') {
    try {
      const rx = new RegExp(filter, 'i');
      return rx.test(val);
    } catch (e) {
      return false;
    }
  }
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // --- Cache check ---
    const cacheKey = searchParams.toString();
    const cached = getDashboardCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'Cache-Control': 'no-store' }
      });
    }
    // --- end cache check ---

    const projectId = searchParams.get('projectId');
    const country = searchParams.get('country') || 'All';
    const category = searchParams.get('category') || 'All';
    const hideExcluded = searchParams.get('hideExcluded') === 'true';
    const daysParam = searchParams.get('days') || '28';
    const days = parseInt(daysParam, 10);
    // Direct date range (from GSC-style picker) — takes priority over days
    const paramStartDate = searchParams.get('startDate') || '';
    const paramEndDate = searchParams.get('endDate') || '';
    const hasExplicitDates = !!(paramStartDate && paramEndDate);

    // Advanced GSC filters
    const queryFilter = searchParams.get('queryFilter') || '';
    const queryFilterType = searchParams.get('queryFilterType') || 'contains';
    const pageFilter = searchParams.get('pageFilter') || '';
    const pageFilterType = searchParams.get('pageFilterType') || 'contains';
    const deviceFilter = searchParams.get('deviceFilter') || 'All';
    const compareMode = searchParams.get('compareMode') === 'true';

    // True GSC Filter Comparison params
    const compareFilterType = searchParams.get('compareFilterType') || 'none'; // 'none' | 'query' | 'page' | 'country' | 'device'
    const compareValueA = searchParams.get('compareValueA') || '';
    const compareValueB = searchParams.get('compareValueB') || '';
    const compareOperator = searchParams.get('compareOperator') || 'contains';

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const project = await store.getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 1. Fetch all keywords for the project
    const allKeywords = await store.getKeywords(projectId);
    
    // Fetch custom skip rules to filter immediately from dashboard
    const metas = await store.getProjectMeta(projectId);
    const skipMeta = metas.find(m => m.key === 'skip_keywords');
    const skipKeywords: string[] = skipMeta ? JSON.parse(skipMeta.value) : [];
    const skipKeywordsLower = skipKeywords.map(k => k.toLowerCase());

    // Filter keywords
    const filteredKeywords = allKeywords.filter(k => {
      // Hard exclusion flag in DB
      if (hideExcluded && k.is_excluded) return false;
      
      // Filter out keywords matching custom skip rules
      const kwLower = k.keyword.toLowerCase();
      const isCustomSkipped = skipKeywordsLower.some(pattern => 
        kwLower === pattern || kwLower.includes(pattern)
      );
      if (isCustomSkipped) return false;
      
      if (category !== 'All' && k.category !== category) return false;
      if (country !== 'All' && k.country !== country) return false;
      if (queryFilter && !matchesFilter(k.keyword, queryFilter, queryFilterType)) return false;
      return true;
    });

    const filteredKwIds = new Set(filteredKeywords.map(k => k.id));

    // Get list of available countries from the project's keywords for UI filter dropdown
    const countryCounts: Record<string, number> = {};
    allKeywords.forEach(k => {
      if (k.country) {
        countryCounts[k.country] = (countryCounts[k.country] || 0) + 1;
      }
    });
    const countriesList = Object.entries(countryCounts)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);

    if (filteredKeywords.length === 0) {
      const emptyBody = {
        kpis: {
          clicks: 0, priorClicks: 0, clicksDiff: 0, clicksDiffPercent: 0,
          impressions: 0, priorImpressions: 0, impressionsDiff: 0, impressionsDiffPercent: 0,
          position: 0, priorPosition: 0, positionDiff: 0,
          ctr: 0, priorCtr: 0, ctrDiff: 0
        },
        chartData: [],
        keywords: [],
        countries: countriesList
      };
      setDashboardCache(cacheKey, emptyBody);
      return NextResponse.json(emptyBody);
    }

    // Step 1: Find the anchor date from property_totals (small dataset, fast)
    // We need this BEFORE fetching rankings so we can pass the date range.
    const [dbPropertyTotals, annotationsList] = await Promise.all([
      store.getPropertyTotals(projectId),
      store.getAnnotations(projectId)
    ]);

    // Determine the most recent date we have data for
    let maxDateStr = '';
    for (const t of dbPropertyTotals) {
      if (t.date > maxDateStr) maxDateStr = t.date;
    }
    // If no property totals, do a cheap scan with a limited window
    if (!maxDateStr) {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      maxDateStr = twoDaysAgo.toISOString().split('T')[0];
    }

    // When a category, query, or page filter is active we fall back to query-level
    // rankings (not property totals). In that case, cap maxDateStr to the most recent
    // date that actually has ranking files — otherwise the 24H window queries a date
    // newer than the ranking data (e.g. propertyTotals reached 2026-06-02 but rankings
    // only go to 2026-05-31) and returns 0 clicks/impressions.
    const isFilteredMode = category !== 'All' || !!queryFilter || !!pageFilter || deviceFilter !== 'All';
    if (isFilteredMode) {
      const rankingMaxDate = store.getMaxRankingDate(projectId);
      if (rankingMaxDate && rankingMaxDate < maxDateStr) {
        maxDateStr = rankingMaxDate;
      }
    }

    // Calculate period date strings
    const getOffsetDate = (anchor: string, offset: number) => {
      const d = new Date(anchor);
      d.setDate(d.getDate() + offset);
      return d.toISOString().split('T')[0];
    };

    let currentStart: string;
    let priorEnd: string;
    let priorStart: string;

    if (hasExplicitDates) {
      // Use dates as provided, but if the end date is newer than our latest available data,
      // shift the entire range back so it ends at our max available data date.
      // This ensures presets (like Last 24 Hours or Last 7 Days) don't query empty future dates.
      let targetEndDate = paramEndDate;
      let targetStartDate = paramStartDate;

      if (targetEndDate > maxDateStr) {
        const diffMs = new Date(targetEndDate).getTime() - new Date(maxDateStr).getTime();
        const diffDays = Math.round(diffMs / 86400_000);
        if (diffDays > 0) {
          targetEndDate = maxDateStr;
          targetStartDate = getOffsetDate(paramStartDate, -diffDays);
        }
      }

      currentStart = targetStartDate;
      maxDateStr = targetEndDate;

      const rangeDays = Math.max(1, Math.round(
        (new Date(maxDateStr).getTime() - new Date(currentStart).getTime()) / 86400_000
      ) + 1);
      priorEnd = getOffsetDate(currentStart, -1);
      priorStart = getOffsetDate(currentStart, -rangeDays);
    } else {
      currentStart = getOffsetDate(maxDateStr, -(days - 1));
      priorEnd = getOffsetDate(maxDateStr, -days);
      priorStart = getOffsetDate(maxDateStr, -(2 * days - 1));
    }

    // Step 2: Fetch ONLY the rows we need — 2×days window instead of all-time history.
    // If property_totals didn't have a date, also scan rankings for max date.
    const [currentRankingsRaw, priorRankingsRaw] = await Promise.all([
      store.getRankingsInRange(projectId, currentStart, maxDateStr),
      store.getRankingsInRange(projectId, priorStart, priorEnd)
    ]);

    // If we still have no maxDate from property_totals, derive it from the fetched rankings
    if (!dbPropertyTotals.length) {
      for (const r of currentRankingsRaw) {
        if (r.date > maxDateStr) maxDateStr = r.date;
      }
    }

    // Helper to filter/adjust rankings by device filter (simulated device split)
    const filterAndSimulateDevice = (rankings: Ranking[], filter: string) => {
      return rankings.map(r => {
        let factor = 1.0;
        let posShift = 0;
        if (filter === 'Desktop') {
          factor = 0.60;
          posShift = -0.5;
        } else if (filter === 'Mobile') {
          factor = 0.38;
          posShift = 0.8;
        } else if (filter === 'Tablet') {
          factor = 0.02;
          posShift = 1.5;
        }
        return {
          ...r,
          clicks: Math.round(r.clicks * factor),
          impressions: Math.round(r.impressions * factor),
          position: Math.max(1.0, r.position + posShift)
        };
      });
    };

    // Filter within the date-range results for keyword + page filters
    let currentRankings = currentRankingsRaw.filter(r =>
      filteredKwIds.has(r.keyword_id) &&
      (!pageFilter || matchesFilter(r.ranking_url, pageFilter, pageFilterType))
    );
    let priorRankings = priorRankingsRaw.filter(r =>
      filteredKwIds.has(r.keyword_id) &&
      (!pageFilter || matchesFilter(r.ranking_url, pageFilter, pageFilterType))
    );

    // Apply device filter
    if (deviceFilter !== 'All') {
      currentRankings = filterAndSimulateDevice(currentRankings, deviceFilter);
      priorRankings = filterAndSimulateDevice(priorRankings, deviceFilter);
    }

    // --- TRUE GSC FILTER COMPARISON BRANCH ---
    if (compareFilterType !== 'none') {
      const kwMap = new Map<string, any>();
      allKeywords.forEach(k => kwMap.set(k.id, k));

      let rankingsA: Ranking[] = [];
      let rankingsB: Ranking[] = [];

      if (compareFilterType === 'query') {
        rankingsA = currentRankings.filter(r => matchesFilter(kwMap.get(r.keyword_id)?.keyword || '', compareValueA, compareOperator));
        rankingsB = currentRankings.filter(r => matchesFilter(kwMap.get(r.keyword_id)?.keyword || '', compareValueB, compareOperator));
      } else if (compareFilterType === 'page') {
        rankingsA = currentRankings.filter(r => matchesFilter(r.ranking_url, compareValueA, compareOperator));
        rankingsB = currentRankings.filter(r => matchesFilter(r.ranking_url, compareValueB, compareOperator));
      } else if (compareFilterType === 'country') {
        rankingsA = currentRankings.filter(r => (kwMap.get(r.keyword_id)?.country || '').toUpperCase() === compareValueA.toUpperCase());
        rankingsB = currentRankings.filter(r => (kwMap.get(r.keyword_id)?.country || '').toUpperCase() === compareValueB.toUpperCase());
      } else if (compareFilterType === 'device') {
        rankingsA = filterAndSimulateDevice(currentRankings, compareValueA);
        rankingsB = filterAndSimulateDevice(currentRankings, compareValueB);
      }

      // Calculate comparative KPIs
      const clicksA = rankingsA.reduce((sum, r) => sum + r.clicks, 0);
      const impressionsA = rankingsA.reduce((sum, r) => sum + r.impressions, 0);
      const weightedPosSumA = rankingsA.reduce((sum, r) => sum + r.position * r.impressions, 0);
      const ctrA = impressionsA > 0 ? clicksA / impressionsA : 0;
      const positionA = impressionsA > 0 ? weightedPosSumA / impressionsA : (rankingsA.length > 0 ? rankingsA.reduce((sum, r) => sum + r.position, 0) / rankingsA.length : 0);

      const clicksB = rankingsB.reduce((sum, r) => sum + r.clicks, 0);
      const impressionsB = rankingsB.reduce((sum, r) => sum + r.impressions, 0);
      const weightedPosSumB = rankingsB.reduce((sum, r) => sum + r.position * r.impressions, 0);
      const ctrB = impressionsB > 0 ? clicksB / impressionsB : 0;
      const positionB = impressionsB > 0 ? weightedPosSumB / impressionsB : (rankingsB.length > 0 ? rankingsB.reduce((sum, r) => sum + r.position, 0) / rankingsB.length : 0);

      const kpis = {
        clicks: clicksA,
        clicksB: clicksB,
        clicksDiff: clicksA - clicksB,
        impressions: impressionsA,
        impressionsB: impressionsB,
        impressionsDiff: impressionsA - impressionsB,
        ctr: Math.round(ctrA * 10000) / 10000,
        ctrB: Math.round(ctrB * 10000) / 10000,
        ctrDiff: Math.round((ctrA - ctrB) * 10000) / 10000,
        position: Math.round(positionA * 100) / 100,
        positionB: Math.round(positionB * 100) / 100,
        positionDiff: Math.round((positionB - positionA) * 100) / 100
      };

      // Chart daily points
      const chartMap = new Map<string, { date: string; clicksA: number; impressionsA: number; posSumA: number; countA: number; clicksB: number; impressionsB: number; posSumB: number; countB: number }>();
      rankingsA.forEach(r => {
        const ext = chartMap.get(r.date) || { date: r.date, clicksA: 0, impressionsA: 0, posSumA: 0, countA: 0, clicksB: 0, impressionsB: 0, posSumB: 0, countB: 0 };
        ext.clicksA += r.clicks;
        ext.impressionsA += r.impressions;
        ext.posSumA += r.position * r.impressions;
        ext.countA += 1;
        chartMap.set(r.date, ext);
      });
      rankingsB.forEach(r => {
        const ext = chartMap.get(r.date) || { date: r.date, clicksA: 0, impressionsA: 0, posSumA: 0, countA: 0, clicksB: 0, impressionsB: 0, posSumB: 0, countB: 0 };
        ext.clicksB += r.clicks;
        ext.impressionsB += r.impressions;
        ext.posSumB += r.position * r.impressions;
        ext.countB += 1;
        chartMap.set(r.date, ext);
      });

      const chartData = Array.from(chartMap.values()).map(d => {
        const avgPosA = d.impressionsA > 0 ? (d.posSumA / d.impressionsA) : (d.countA > 0 ? d.posSumA / d.countA : 0);
        const ctrA = d.impressionsA > 0 ? (d.clicksA / d.impressionsA) : 0;
        
        const avgPosB = d.impressionsB > 0 ? (d.posSumB / d.impressionsB) : (d.countB > 0 ? d.posSumB / d.countB : 0);
        const ctrB = d.impressionsB > 0 ? (d.clicksB / d.impressionsB) : 0;
        
        return {
          date: d.date,
          clicks: d.clicksA,
          impressions: d.impressionsA,
          position: Math.round(avgPosA * 100) / 100,
          ctr: Math.round(ctrA * 10000) / 10000,
          clicksPrior: d.clicksB,
          impressionsPrior: d.impressionsB,
          positionPrior: Math.round(avgPosB * 100) / 100,
          ctrPrior: Math.round(ctrB * 10000) / 10000
        };
      }).sort((a, b) => a.date.localeCompare(b.date));

      // Table rollups
      // QUERIES
      const kwMapA = new Map<string, { clicks: number; impressions: number; posSum: number }>();
      rankingsA.forEach(r => {
        const ext = kwMapA.get(r.keyword_id) || { clicks: 0, impressions: 0, posSum: 0 };
        ext.clicks += r.clicks; ext.impressions += r.impressions; ext.posSum += r.position * r.impressions;
        kwMapA.set(r.keyword_id, ext);
      });
      const kwMapB = new Map<string, { clicks: number; impressions: number; posSum: number }>();
      rankingsB.forEach(r => {
        const ext = kwMapB.get(r.keyword_id) || { clicks: 0, impressions: 0, posSum: 0 };
        ext.clicks += r.clicks; ext.impressions += r.impressions; ext.posSum += r.position * r.impressions;
        kwMapB.set(r.keyword_id, ext);
      });

      const tableKeywords = filteredKeywords.map(k => {
        const dataA = kwMapA.get(k.id) || { clicks: 0, impressions: 0, posSum: 0 };
        const dataB = kwMapB.get(k.id) || { clicks: 0, impressions: 0, posSum: 0 };
        const posA = dataA.impressions > 0 ? dataA.posSum / dataA.impressions : 0;
        const posB = dataB.impressions > 0 ? dataB.posSum / dataB.impressions : 0;
        return {
          id: k.id,
          keyword: k.keyword,
          country: k.country,
          category: k.category || 'Blog',
          intent: k.intent || 'Informational',
          is_excluded: k.is_excluded,
          clicks: dataA.clicks,
          clicksB: dataB.clicks,
          clicksDiff: dataA.clicks - dataB.clicks,
          impressions: dataA.impressions,
          impressionsB: dataB.impressions,
          ctr: dataA.impressions > 0 ? Math.round((dataA.clicks / dataA.impressions) * 10000) / 10000 : 0,
          ctrB: dataB.impressions > 0 ? Math.round((dataB.clicks / dataB.impressions) * 10000) / 10000 : 0,
          position: posA > 0 ? Math.round(posA * 10) / 10 : 100,
          positionB: posB > 0 ? Math.round(posB * 10) / 10 : 100,
          change: 0,
          isCannibalized: false
        };
      });

      // PAGES
      const pageMapA = new Map<string, { clicks: number; impressions: number; posSum: number }>();
      rankingsA.forEach(r => {
        if (!r.ranking_url) return;
        const ext = pageMapA.get(r.ranking_url) || { clicks: 0, impressions: 0, posSum: 0 };
        ext.clicks += r.clicks; ext.impressions += r.impressions; ext.posSum += r.position * r.impressions;
        pageMapA.set(r.ranking_url, ext);
      });
      const pageMapB = new Map<string, { clicks: number; impressions: number; posSum: number }>();
      rankingsB.forEach(r => {
        if (!r.ranking_url) return;
        const ext = pageMapB.get(r.ranking_url) || { clicks: 0, impressions: 0, posSum: 0 };
        ext.clicks += r.clicks; ext.impressions += r.impressions; ext.posSum += r.position * r.impressions;
        pageMapB.set(r.ranking_url, ext);
      });
      const allUrls = new Set([...Array.from(pageMapA.keys()), ...Array.from(pageMapB.keys())]);
      const tablePages = Array.from(allUrls).map(url => {
        const dataA = pageMapA.get(url) || { clicks: 0, impressions: 0, posSum: 0 };
        const dataB = pageMapB.get(url) || { clicks: 0, impressions: 0, posSum: 0 };
        const posA = dataA.impressions > 0 ? dataA.posSum / dataA.impressions : 0;
        const posB = dataB.impressions > 0 ? dataB.posSum / dataB.impressions : 0;
        return {
          ranking_url: url,
          clicks: dataA.clicks,
          clicksB: dataB.clicks,
          clicksDiff: dataA.clicks - dataB.clicks,
          impressions: dataA.impressions,
          impressionsB: dataB.impressions,
          ctr: dataA.impressions > 0 ? Math.round((dataA.clicks / dataA.impressions) * 10000) / 10000 : 0,
          ctrB: dataB.impressions > 0 ? Math.round((dataB.clicks / dataB.impressions) * 10000) / 10000 : 0,
          position: Math.round(posA * 10) / 10,
          positionB: Math.round(posB * 10) / 10
        };
      });

      // COUNTRIES
      const countryMapA = new Map<string, { clicks: number; impressions: number; posSum: number }>();
      rankingsA.forEach(r => {
        const cCode = kwMap.get(r.keyword_id)?.country || 'US';
        const ext = countryMapA.get(cCode) || { clicks: 0, impressions: 0, posSum: 0 };
        ext.clicks += r.clicks; ext.impressions += r.impressions; ext.posSum += r.position * r.impressions;
        countryMapA.set(cCode, ext);
      });
      const countryMapB = new Map<string, { clicks: number; impressions: number; posSum: number }>();
      rankingsB.forEach(r => {
        const cCode = kwMap.get(r.keyword_id)?.country || 'US';
        const ext = countryMapB.get(cCode) || { clicks: 0, impressions: 0, posSum: 0 };
        ext.clicks += r.clicks; ext.impressions += r.impressions; ext.posSum += r.position * r.impressions;
        countryMapB.set(cCode, ext);
      });
      const allCountries = new Set([...Array.from(countryMapA.keys()), ...Array.from(countryMapB.keys())]);
      const tableCountries = Array.from(allCountries).map(code => {
        const dataA = countryMapA.get(code) || { clicks: 0, impressions: 0, posSum: 0 };
        const dataB = countryMapB.get(code) || { clicks: 0, impressions: 0, posSum: 0 };
        const posA = dataA.impressions > 0 ? dataA.posSum / dataA.impressions : 0;
        const posB = dataB.impressions > 0 ? dataB.posSum / dataB.impressions : 0;
        return {
          code,
          clicks: dataA.clicks,
          clicksB: dataB.clicks,
          clicksDiff: dataA.clicks - dataB.clicks,
          impressions: dataA.impressions,
          impressionsB: dataB.impressions,
          ctr: dataA.impressions > 0 ? Math.round((dataA.clicks / dataA.impressions) * 10000) / 10000 : 0,
          ctrB: dataB.impressions > 0 ? Math.round((dataB.clicks / dataB.impressions) * 10000) / 10000 : 0,
          position: Math.round(posA * 10) / 10,
          positionB: Math.round(posB * 10) / 10
        };
      });

      // DEVICES
      const tableDevices = [
        {
          name: 'Desktop',
          clicks: Math.round(clicksA * 0.60), clicksB: Math.round(clicksB * 0.60), clicksDiff: Math.round((clicksA - clicksB) * 0.60),
          impressions: Math.round(impressionsA * 0.60), impressionsB: Math.round(impressionsB * 0.60),
          ctr: kpis.ctr, ctrB: kpis.ctrB,
          position: Math.round(Math.max(1.0, positionA * 0.95) * 10) / 10, positionB: Math.round(Math.max(1.0, positionB * 0.95) * 10) / 10
        },
        {
          name: 'Mobile',
          clicks: Math.round(clicksA * 0.38), clicksB: Math.round(clicksB * 0.38), clicksDiff: Math.round((clicksA - clicksB) * 0.38),
          impressions: Math.round(impressionsA * 0.38), impressionsB: Math.round(impressionsB * 0.38),
          ctr: kpis.ctr, ctrB: kpis.ctrB,
          position: Math.round(Math.max(1.0, positionA * 1.05) * 10) / 10, positionB: Math.round(Math.max(1.0, positionB * 1.05) * 10) / 10
        },
        {
          name: 'Tablet',
          clicks: Math.round(clicksA * 0.02), clicksB: Math.round(clicksB * 0.02), clicksDiff: Math.round((clicksA - clicksB) * 0.02),
          impressions: Math.round(impressionsA * 0.02), impressionsB: Math.round(impressionsB * 0.02),
          ctr: kpis.ctr, ctrB: kpis.ctrB,
          position: Math.round(Math.max(1.0, positionA * 1.15) * 10) / 10, positionB: Math.round(Math.max(1.0, positionB * 1.15) * 10) / 10
        }
      ];

      // SEARCH APPEARANCES
      const tableAppearances = [
        {
          name: 'Good Page Experience',
          clicks: Math.round(clicksA * 0.45), clicksB: Math.round(clicksB * 0.45), clicksDiff: Math.round((clicksA - clicksB) * 0.45),
          impressions: Math.round(impressionsA * 0.42), impressionsB: Math.round(impressionsB * 0.42),
          ctr: Math.round(kpis.ctr * 1.07 * 10000) / 10000, ctrB: Math.round(kpis.ctrB * 1.07 * 10000) / 10000,
          position: Math.round(Math.max(1.0, positionA * 0.85) * 10) / 10, positionB: Math.round(Math.max(1.0, positionB * 0.85) * 10) / 10
        },
        {
          name: 'Review Snippets',
          clicks: Math.round(clicksA * 0.12), clicksB: Math.round(clicksB * 0.12), clicksDiff: Math.round((clicksA - clicksB) * 0.12),
          impressions: Math.round(impressionsA * 0.15), impressionsB: Math.round(impressionsB * 0.15),
          ctr: Math.round(kpis.ctr * 0.80 * 10000) / 10000, ctrB: Math.round(kpis.ctrB * 0.80 * 10000) / 10000,
          position: Math.round(Math.max(1.0, positionA * 0.90) * 10) / 10, positionB: Math.round(Math.max(1.0, positionB * 0.90) * 10) / 10
        },
        {
          name: 'Merchant Listings',
          clicks: Math.round(clicksA * 0.08), clicksB: Math.round(clicksB * 0.08), clicksDiff: Math.round((clicksA - clicksB) * 0.08),
          impressions: Math.round(impressionsA * 0.10), impressionsB: Math.round(impressionsB * 0.10),
          ctr: Math.round(kpis.ctr * 0.80 * 10000) / 10000, ctrB: Math.round(kpis.ctrB * 0.80 * 10000) / 10000,
          position: Math.round(Math.max(1.0, positionA * 0.75) * 10) / 10, positionB: Math.round(Math.max(1.0, positionB * 0.75) * 10) / 10
        }
      ];

      // DAYS
      const daysMapA = new Map<string, { clicks: number; impressions: number; posSum: number }>();
      rankingsA.forEach(r => {
        const ext = daysMapA.get(r.date) || { clicks: 0, impressions: 0, posSum: 0 };
        ext.clicks += r.clicks; ext.impressions += r.impressions; ext.posSum += r.position * r.impressions;
        daysMapA.set(r.date, ext);
      });
      const daysMapB = new Map<string, { clicks: number; impressions: number; posSum: number }>();
      rankingsB.forEach(r => {
        const ext = daysMapB.get(r.date) || { clicks: 0, impressions: 0, posSum: 0 };
        ext.clicks += r.clicks; ext.impressions += r.impressions; ext.posSum += r.position * r.impressions;
        daysMapB.set(r.date, ext);
      });
      const allDays = new Set([...Array.from(daysMapA.keys()), ...Array.from(daysMapB.keys())]);
      const tableDays = Array.from(allDays).map(date => {
        const dataA = daysMapA.get(date) || { clicks: 0, impressions: 0, posSum: 0 };
        const dataB = daysMapB.get(date) || { clicks: 0, impressions: 0, posSum: 0 };
        const posA = dataA.impressions > 0 ? dataA.posSum / dataA.impressions : 0;
        const posB = dataB.impressions > 0 ? dataB.posSum / dataB.impressions : 0;
        return {
          date,
          clicks: dataA.clicks,
          clicksB: dataB.clicks,
          clicksDiff: dataA.clicks - dataB.clicks,
          impressions: dataA.impressions,
          impressionsB: dataB.impressions,
          ctr: dataA.impressions > 0 ? Math.round((dataA.clicks / dataA.impressions) * 10000) / 10000 : 0,
          ctrB: dataB.impressions > 0 ? Math.round((dataB.clicks / dataB.impressions) * 10000) / 10000 : 0,
          position: Math.round(posA * 10) / 10,
          positionB: Math.round(posB * 10) / 10
        };
      });

      const compareBody = {
        compareMode: true,
        compareFilterType,
        compareValueA,
        compareValueB,
        compareOperator,
        kpis,
        chartData,
        keywords: tableKeywords,
        pages: tablePages,
        countries: tableCountries,
        devices: tableDevices,
        searchAppearances: tableAppearances,
        days: tableDays,
        cannibalized: [],
        brandedSplit: {
          branded: { clicks: clicksA, impressions: impressionsA, ctr: ctrA, position: positionA },
          nonBranded: { clicks: clicksB, impressions: impressionsB, ctr: ctrB, position: positionB }
        },
        googleUpdates: [],
        annotations: [],
        countriesList,
        asOfDate: maxDateStr
      };
      setDashboardCache(cacheKey, compareBody);
      return NextResponse.json(compareBody);
    }

    // Filter property totals within current and prior periods
    const currentPropTotals = dbPropertyTotals.filter(t => {
      if (t.date < currentStart || t.date > maxDateStr) return false;
      if (country !== 'All' && t.country !== country) return false;
      return true;
    });

    const priorPropTotals = dbPropertyTotals.filter(t => {
      if (t.date < priorStart || t.date > priorEnd) return false;
      if (country !== 'All' && t.country !== country) return false;
      return true;
    });

    // We only use GSC property totals if:
    // 1. category/segment is 'All'
    // 2. queryFilter is empty
    // 3. pageFilter is empty
    // 4. deviceFilter is 'All'
    // 5. We have property totals in the DB
    const usePropertyTotals = category === 'All' && 
                            !queryFilter && 
                            !pageFilter && 
                            deviceFilter === 'All' && 
                            dbPropertyTotals.length > 0;

    // Calculate current KPI totals
    let curClicks = 0;
    let curImpressions = 0;
    let curWeightedPosSum = 0;
    
    if (usePropertyTotals) {
      currentPropTotals.forEach(t => {
        curClicks += t.clicks;
        curImpressions += t.impressions;
        curWeightedPosSum += t.position * t.impressions;
      });
    } else {
      currentRankings.forEach(r => {
        curClicks += r.clicks;
        curImpressions += r.impressions;
        curWeightedPosSum += r.position * r.impressions;
      });
    }

    const curCtr = curImpressions > 0 ? (curClicks / curImpressions) : 0;
    const curPos = curImpressions > 0 
      ? (curWeightedPosSum / curImpressions) 
      : (usePropertyTotals 
         ? (currentPropTotals.length > 0 ? currentPropTotals.reduce((sum, t) => sum + t.position, 0) / currentPropTotals.length : 0)
         : (currentRankings.length > 0 ? currentRankings.reduce((sum, r) => sum + r.position, 0) / currentRankings.length : 0));

    // Calculate prior KPI totals
    let priClicks = 0;
    let priImpressions = 0;
    let priWeightedPosSum = 0;

    if (usePropertyTotals) {
      priorPropTotals.forEach(t => {
        priClicks += t.clicks;
        priImpressions += t.impressions;
        priWeightedPosSum += t.position * t.impressions;
      });
    } else {
      priorRankings.forEach(r => {
        priClicks += r.clicks;
        priImpressions += r.impressions;
        priWeightedPosSum += r.position * r.impressions;
      });
    }

    const priCtr = priImpressions > 0 ? (priClicks / priImpressions) : 0;
    const priPos = priImpressions > 0 
      ? (priWeightedPosSum / priImpressions) 
      : (usePropertyTotals 
         ? (priorPropTotals.length > 0 ? priorPropTotals.reduce((sum, t) => sum + t.position, 0) / priorPropTotals.length : 0)
         : (priorRankings.length > 0 ? priorRankings.reduce((sum, r) => sum + r.position, 0) / priorRankings.length : 0));

    // KPI differences
    const clicksDiff = curClicks - priClicks;
    const clicksDiffPercent = priClicks > 0 ? (clicksDiff / priClicks) * 100 : 0;

    const impressionsDiff = curImpressions - priImpressions;
    const impressionsDiffPercent = priImpressions > 0 ? (impressionsDiff / priImpressions) * 100 : 0;

    const positionDiff = priPos > 0 && curPos > 0 ? priPos - curPos : 0;
    const ctrDiff = curCtr - priCtr;

    const kpis = {
      clicks: curClicks,
      priorClicks: priClicks,
      clicksDiff,
      clicksDiffPercent: Math.round(clicksDiffPercent * 100) / 100,
      impressions: curImpressions,
      priorImpressions: priImpressions,
      impressionsDiff,
      impressionsDiffPercent: Math.round(impressionsDiffPercent * 100) / 100,
      position: Math.round(curPos * 100) / 100,
      priorPosition: Math.round(priPos * 100) / 100,
      positionDiff: Math.round(positionDiff * 100) / 100,
      ctr: Math.round(curCtr * 10000) / 10000,
      priorCtr: Math.round(priCtr * 10000) / 10000,
      ctrDiff: Math.round(ctrDiff * 10000) / 10000
    };

    // 3. Prepare Chart Data (Group current rankings by date)
    const chartMap = new Map<string, { date: string; clicks: number; impressions: number; weightedPosSum: number; count: number; clicksPrior: number; impressionsPrior: number; weightedPosSumPrior: number; countPrior: number }>();
    
    // Fill active period values
    if (usePropertyTotals) {
      currentPropTotals.forEach(t => {
        const existing = chartMap.get(t.date);
        if (existing) {
          existing.clicks += t.clicks;
          existing.impressions += t.impressions;
          existing.weightedPosSum += t.position * t.impressions;
          existing.count += 1;
        } else {
          chartMap.set(t.date, {
            date: t.date, clicks: t.clicks, impressions: t.impressions, weightedPosSum: t.position * t.impressions, count: 1,
            clicksPrior: 0, impressionsPrior: 0, weightedPosSumPrior: 0, countPrior: 0
          });
        }
      });
    } else {
      currentRankings.forEach(r => {
        const existing = chartMap.get(r.date);
        if (existing) {
          existing.clicks += r.clicks;
          existing.impressions += r.impressions;
          existing.weightedPosSum += r.position * r.impressions;
          existing.count += 1;
        } else {
          chartMap.set(r.date, {
            date: r.date, clicks: r.clicks, impressions: r.impressions, weightedPosSum: r.position * r.impressions, count: 1,
            clicksPrior: 0, impressionsPrior: 0, weightedPosSumPrior: 0, countPrior: 0
          });
        }
      });
    }

    // Fill comparison period values if compareMode enabled
    if (compareMode) {
      if (usePropertyTotals) {
        priorPropTotals.forEach(t => {
          // Find matching date in current period: D_current = D_prior + days
          const curDateStr = getOffsetDate(t.date, days);
          const existing = chartMap.get(curDateStr);
          if (existing) {
            existing.clicksPrior += t.clicks;
            existing.impressionsPrior += t.impressions;
            existing.weightedPosSumPrior += t.position * t.impressions;
            existing.countPrior += 1;
          }
        });
      } else {
        priorRankings.forEach(r => {
          const curDateStr = getOffsetDate(r.date, days);
          const existing = chartMap.get(curDateStr);
          if (existing) {
            existing.clicksPrior += r.clicks;
            existing.impressionsPrior += r.impressions;
            existing.weightedPosSumPrior += r.position * r.impressions;
            existing.countPrior += 1;
          }
        });
      }
    }

    // Populate missing dates in range to keep chart continuous
    const chartData = Array.from(chartMap.values()).map(d => {
      const avgPos = d.impressions > 0 ? (d.weightedPosSum / d.impressions) : (d.weightedPosSum / d.count);
      const ctr = d.impressions > 0 ? (d.clicks / d.impressions) : 0;
      
      const avgPosPrior = d.impressionsPrior > 0 ? (d.weightedPosSumPrior / d.impressionsPrior) : (d.weightedPosSumPrior / (d.countPrior || 1));
      const ctrPrior = d.impressionsPrior > 0 ? (d.clicksPrior / d.impressionsPrior) : 0;
      
      return {
        date: d.date,
        clicks: d.clicks,
        impressions: d.impressions,
        position: Math.round(avgPos * 100) / 100,
        ctr: Math.round(ctr * 10000) / 10000,
        clicksPrior: d.clicksPrior,
        impressionsPrior: d.impressionsPrior,
        positionPrior: Math.round(avgPosPrior * 100) / 100,
        ctrPrior: Math.round(ctrPrior * 10000) / 10000
      };
    }).sort((a, b) => a.date.localeCompare(b.date));

    // 4. Calculate dynamic keyword rollups for the selected periods
    // Group current rankings by keyword_id once: Map<keyword_id, Set<ranking_url>>
    const kwUrlsGrouped = new Map<string, Set<string>>();
    currentRankings.forEach(r => {
      if (!r.ranking_url) return;
      let set = kwUrlsGrouped.get(r.keyword_id);
      if (!set) {
        set = new Set();
        kwUrlsGrouped.set(r.keyword_id, set);
      }
      set.add(r.ranking_url);
    });

    // Group current period rankings by keyword_id for stats calculation
    const curKwMap = new Map<string, { clicks: number; impressions: number; weightedPosSum: number; count: number; urls: Record<string, number> }>();
    currentRankings.forEach(r => {
      let ext = curKwMap.get(r.keyword_id);
      if (!ext) {
        ext = { clicks: 0, impressions: 0, weightedPosSum: 0, count: 0, urls: {} };
        curKwMap.set(r.keyword_id, ext);
      }
      ext.clicks += r.clicks;
      ext.impressions += r.impressions;
      ext.weightedPosSum += r.position * r.impressions;
      ext.count += 1;
      if (r.ranking_url) {
        ext.urls[r.ranking_url] = (ext.urls[r.ranking_url] || 0) + r.impressions;
      }
    });

    // Group prior period rankings by keyword_id for stats calculation
    const priKwMap = new Map<string, { clicks: number; impressions: number; weightedPosSum: number; count: number }>();
    priorRankings.forEach(r => {
      let ext = priKwMap.get(r.keyword_id);
      if (!ext) {
        ext = { clicks: 0, impressions: 0, weightedPosSum: 0, count: 0 };
        priKwMap.set(r.keyword_id, ext);
      }
      ext.clicks += r.clicks;
      ext.impressions += r.impressions;
      ext.weightedPosSum += r.position * r.impressions;
      ext.count += 1;
    });

    // Prepare QUERIES (Keywords list)
    const tableKeywords = filteredKeywords.map(k => {
      const curData = curKwMap.get(k.id);
      const priData = priKwMap.get(k.id);

      let clicks = 0;
      let impressions = 0;
      let position = 100;
      let ctr = 0;
      let change = 0;
      let ranking_url = '';

      if (curData) {
        clicks = curData.clicks;
        impressions = curData.impressions;
        ctr = impressions > 0 ? (clicks / impressions) : 0;
        
        const avgPos = curData.impressions > 0 
          ? (curData.weightedPosSum / curData.impressions) 
          : (curData.weightedPosSum / curData.count);
        position = Math.round(avgPos * 100) / 100;

        // Find the URL with the max impressions in the current period
        let bestUrl = '';
        let maxImps = -1;
        for (const [url, imps] of Object.entries(curData.urls)) {
          if (imps > maxImps) {
            maxImps = imps;
            bestUrl = url;
          }
        }
        ranking_url = bestUrl;
      }

      if (priData && curData) {
        const avgPosPrior = priData.impressions > 0 
          ? (priData.weightedPosSum / priData.impressions) 
          : (priData.weightedPosSum / priData.count);
        const positionPrior = Math.round(avgPosPrior * 100) / 100;
        
        // Position improvement is positive (e.g. from 10 to 3 is +7)
        change = positionPrior - position;
      }

      // Check if keyword is cannibalized in this period
      const urlsForKw = kwUrlsGrouped.get(k.id);
      const isCannibalized = urlsForKw ? urlsForKw.size > 1 : false;

      return {
        id: k.id,
        keyword: k.keyword,
        country: k.country,
        category: k.category || 'Blog',
        intent: k.intent || 'Informational',
        is_excluded: k.is_excluded,
        clicks,
        impressions,
        position,
        change: Math.round(change * 100) / 100,
        ctr: Math.round(ctr * 10000) / 10000,
        ranking_url,
        isCannibalized
      };
    });

    // Prepare PAGES (Group current rankings by page URL)
    const pagesMap = new Map<string, { ranking_url: string; clicks: number; impressions: number; weightedPosSum: number; count: number }>();
    currentRankings.forEach(r => {
      if (!r.ranking_url) return;
      const existing = pagesMap.get(r.ranking_url);
      if (existing) {
        existing.clicks += r.clicks;
        existing.impressions += r.impressions;
        existing.weightedPosSum += r.position * r.impressions;
        existing.count += 1;
      } else {
        pagesMap.set(r.ranking_url, {
          ranking_url: r.ranking_url, clicks: r.clicks, impressions: r.impressions, weightedPosSum: r.position * r.impressions, count: 1
        });
      }
    });

    const tablePages = Array.from(pagesMap.values()).map(p => {
      const avgPos = p.impressions > 0 ? (p.weightedPosSum / p.impressions) : (p.weightedPosSum / p.count);
      return {
        ranking_url: p.ranking_url,
        clicks: p.clicks,
        impressions: p.impressions,
        ctr: p.impressions > 0 ? Math.round((p.clicks / p.impressions) * 10000) / 10000 : 0,
        position: Math.round(avgPos * 100) / 100
      };
    }).sort((a, b) => b.clicks - a.clicks);

    // Prepare COUNTRIES
    const countriesMap = new Map<string, { code: string; clicks: number; impressions: number; weightedPosSum: number; count: number }>();
    
    if (usePropertyTotals) {
      currentPropTotals.forEach(t => {
        const existing = countriesMap.get(t.country);
        if (existing) {
          existing.clicks += t.clicks;
          existing.impressions += t.impressions;
          existing.weightedPosSum += t.position * t.impressions;
          existing.count += 1;
        } else {
          countriesMap.set(t.country, {
            code: t.country, clicks: t.clicks, impressions: t.impressions, weightedPosSum: t.position * t.impressions, count: 1
          });
        }
      });
    } else {
      // Resolve country codes via keywords
      const kwCountryMap = new Map<string, string>();
      allKeywords.forEach(k => kwCountryMap.set(k.id, k.country));

      currentRankings.forEach(r => {
        const countryCode = kwCountryMap.get(r.keyword_id) || 'US';
        const existing = countriesMap.get(countryCode);
        if (existing) {
          existing.clicks += r.clicks;
          existing.impressions += r.impressions;
          existing.weightedPosSum += r.position * r.impressions;
          existing.count += 1;
        } else {
          countriesMap.set(countryCode, {
            code: countryCode, clicks: r.clicks, impressions: r.impressions, weightedPosSum: r.position * r.impressions, count: 1
          });
        }
      });
    }

    const tableCountries = Array.from(countriesMap.values()).map(c => {
      const avgPos = c.impressions > 0 ? (c.weightedPosSum / c.impressions) : (c.weightedPosSum / c.count);
      return {
        code: c.code,
        clicks: c.clicks,
        impressions: c.impressions,
        ctr: c.impressions > 0 ? Math.round((c.clicks / c.impressions) * 10000) / 10000 : 0,
        position: Math.round(avgPos * 100) / 100
      };
    }).sort((a, b) => b.clicks - a.clicks);

    // Prepare DEVICES (Simulated)
    const tableDevices = [
      { name: 'Desktop', clicks: Math.round(curClicks * 0.60), impressions: Math.round(curImpressions * 0.60), ctr: Math.round(curCtr * 10000) / 10000, position: Math.round(Math.max(1.0, curPos * 0.95) * 100) / 100 },
      { name: 'Mobile', clicks: Math.round(curClicks * 0.38), impressions: Math.round(curImpressions * 0.38), ctr: Math.round(curCtr * 10000) / 10000, position: Math.round(Math.max(1.0, curPos * 1.05) * 100) / 100 },
      { name: 'Tablet', clicks: Math.round(curClicks * 0.02), impressions: Math.round(curImpressions * 0.02), ctr: Math.round(curCtr * 10000) / 10000, position: Math.round(Math.max(1.0, curPos * 1.15) * 100) / 100 }
    ].sort((a, b) => b.clicks - a.clicks);

    // Prepare SEARCH APPEARANCES (Simulated)
    const tableAppearances = [
      { name: 'Good Page Experience', clicks: Math.round(curClicks * 0.45), impressions: Math.round(curImpressions * 0.42), ctr: Math.round(curCtr * 1.07 * 10000) / 10000, position: Math.round(Math.max(1.0, curPos * 0.85) * 100) / 100 },
      { name: 'Review Snippets', clicks: Math.round(curClicks * 0.12), impressions: Math.round(curImpressions * 0.15), ctr: Math.round(curCtr * 0.80 * 10000) / 10000, position: Math.round(Math.max(1.0, curPos * 0.90) * 100) / 100 },
      { name: 'Merchant Listings', clicks: Math.round(curClicks * 0.08), impressions: Math.round(curImpressions * 0.10), ctr: Math.round(curCtr * 0.80 * 10000) / 10000, position: Math.round(Math.max(1.0, curPos * 0.75) * 100) / 100 }
    ].sort((a, b) => b.clicks - a.clicks);

    // Prepare DAYS (Daily log)
    const tableDaysMap = new Map<string, { date: string; clicks: number; impressions: number; weightedPosSum: number; count: number }>();
    if (usePropertyTotals) {
      currentPropTotals.forEach(t => {
        const existing = tableDaysMap.get(t.date);
        if (existing) {
          existing.clicks += t.clicks;
          existing.impressions += t.impressions;
          existing.weightedPosSum += t.position * t.impressions;
          existing.count += 1;
        } else {
          tableDaysMap.set(t.date, { date: t.date, clicks: t.clicks, impressions: t.impressions, weightedPosSum: t.position * t.impressions, count: 1 });
        }
      });
    } else {
      currentRankings.forEach(r => {
        const existing = tableDaysMap.get(r.date);
        if (existing) {
          existing.clicks += r.clicks;
          existing.impressions += r.impressions;
          existing.weightedPosSum += r.position * r.impressions;
          existing.count += 1;
        } else {
          tableDaysMap.set(r.date, { date: r.date, clicks: r.clicks, impressions: r.impressions, weightedPosSum: r.position * r.impressions, count: 1 });
        }
      });
    }

    const tableDays = Array.from(tableDaysMap.values()).map(d => {
      const avgPos = d.impressions > 0 ? (d.weightedPosSum / d.impressions) : (d.weightedPosSum / d.count);
      return {
        date: d.date,
        clicks: d.clicks,
        impressions: d.impressions,
        ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 10000 : 0,
        position: Math.round(avgPos * 100) / 100
      };
    }).sort((a, b) => b.date.localeCompare(a.date));

    // Prepare CANNIBALIZED keywords explorer list
    const kwMap = new Map<string, string>();
    allKeywords.forEach(k => kwMap.set(k.id, k.keyword));

    const kwUrlsMap = new Map<string, { urls: Set<string>; clicks: number; impressions: number; weightedPosSum: number; count: number }>();
    currentRankings.forEach(r => {
      if (!r.ranking_url) return;
      const kwName = kwMap.get(r.keyword_id) || r.keyword_id;
      const existing = kwUrlsMap.get(kwName);
      if (existing) {
        existing.urls.add(r.ranking_url);
        existing.clicks += r.clicks;
        existing.impressions += r.impressions;
        existing.weightedPosSum += r.position * r.impressions;
        existing.count += 1;
      } else {
        kwUrlsMap.set(kwName, {
          urls: new Set([r.ranking_url]), clicks: r.clicks, impressions: r.impressions, weightedPosSum: r.position * r.impressions, count: 1
        });
      }
    });

    const cannibalizedList = Array.from(kwUrlsMap.entries())
      .filter(([_, data]) => data.urls.size > 1)
      .map(([keyword, data]) => {
        const avgPos = data.impressions > 0 ? (data.weightedPosSum / data.impressions) : (data.weightedPosSum / data.count);
        return {
          keyword,
          urls: Array.from(data.urls),
          clicks: data.clicks,
          impressions: data.impressions,
          position: Math.round(avgPos * 100) / 100,
          ctr: data.impressions > 0 ? Math.round((data.clicks / data.impressions) * 10000) / 10000 : 0
        };
      }).sort((a, b) => b.clicks - a.clicks);

    // Branded vs Non-Branded splits
    let brandedClicks = 0; let brandedImpressions = 0; let brandedPosSum = 0; let brandedCount = 0;
    let nonBrandedClicks = 0; let nonBrandedImpressions = 0; let nonBrandedPosSum = 0; let nonBrandedCount = 0;

    // Brand keywords contain "wpoet" or domain name
    const domainNameMatch = project.domain.replace(/https?:\/\/(www\.)?/, '').split('.')[0];
    const brandPattern = new RegExp(domainNameMatch || 'wpoet', 'i');

    currentRankings.forEach(r => {
      const kwName = kwMap.get(r.keyword_id) || '';
      const isBranded = brandPattern.test(kwName);
      if (isBranded) {
        brandedClicks += r.clicks;
        brandedImpressions += r.impressions;
        brandedPosSum += r.position * r.impressions;
        brandedCount += 1;
      } else {
        nonBrandedClicks += r.clicks;
        nonBrandedImpressions += r.impressions;
        nonBrandedPosSum += r.position * r.impressions;
        nonBrandedCount += 1;
      }
    });

    const brandedSplit = {
      branded: {
        clicks: brandedClicks,
        impressions: brandedImpressions,
        ctr: brandedImpressions > 0 ? Math.round((brandedClicks / brandedImpressions) * 10000) / 10000 : 0,
        position: brandedImpressions > 0 ? Math.round((brandedPosSum / brandedImpressions) * 100) / 100 : (brandedCount > 0 ? 10 : 0)
      },
      nonBranded: {
        clicks: nonBrandedClicks,
        impressions: nonBrandedImpressions,
        ctr: nonBrandedImpressions > 0 ? Math.round((nonBrandedClicks / nonBrandedImpressions) * 10000) / 10000 : 0,
        position: nonBrandedImpressions > 0 ? Math.round((nonBrandedPosSum / nonBrandedImpressions) * 100) / 100 : (nonBrandedCount > 0 ? 25 : 0)
      }
    };

    // 5. Google Core Updates — calculate impact metrics
    const getClicksForRange = async (start: string, end: string) => {
      const rankings = await store.getRankingsInRange(projectId, start, end);
      let totalClicks = 0;
      for (const r of rankings) {
        if (filteredKwIds.has(r.keyword_id)) {
          totalClicks += r.clicks;
        }
      }
      return totalClicks;
    };

    const googleUpdatesWithImpact = await Promise.all(
      GOOGLE_UPDATES
        .filter(upd => upd.startDate <= maxDateStr && (!upd.endDate || upd.endDate >= currentStart))
        .map(async upd => {
          const beforeStart = getOffsetDate(upd.startDate, -14);
          const beforeEnd = getOffsetDate(upd.startDate, -1);
          const afterStart = upd.startDate;
          const afterEnd = getOffsetDate(upd.startDate, 13);

          const [beforeClicks, afterClicks] = await Promise.all([
            getClicksForRange(beforeStart, beforeEnd),
            getClicksForRange(afterStart, afterEnd)
          ]);

          const clicksChangePercent = beforeClicks > 0
            ? Math.round(((afterClicks - beforeClicks) / beforeClicks) * 1000) / 10
            : 0;

          return {
            ...upd,
            beforeClicks,
            afterClicks,
            clicksChangePercent,
            beforePos: 0,
            afterPos: 0,
            posChange: 0,
            impact: (clicksChangePercent > 5 ? 'positive' : clicksChangePercent < -5 ? 'negative' : 'neutral') as any,
            impactPending: false
          };
        })
    );
    googleUpdatesWithImpact.sort((a, b) => b.startDate.localeCompare(a.startDate));

    // 6. Annotations — calculate before/after impact
    const annotationsWithImpact = await Promise.all(
      annotationsList
        .filter(ann => ann.date >= currentStart && ann.date <= maxDateStr)
        .map(async ann => {
          const beforeStart = getOffsetDate(ann.date, -14);
          const beforeEnd = getOffsetDate(ann.date, -1);
          const afterStart = ann.date;
          const afterEnd = getOffsetDate(ann.date, 13);

          const [beforeClicks, afterClicks] = await Promise.all([
            getClicksForRange(beforeStart, beforeEnd),
            getClicksForRange(afterStart, afterEnd)
          ]);

          const clicksChangePercent = beforeClicks > 0
            ? Math.round(((afterClicks - beforeClicks) / beforeClicks) * 1000) / 10
            : 0;

          return {
            ...ann,
            beforeClicks,
            afterClicks,
            clicksChangePercent,
            beforePos: 0,
            afterPos: 0,
            posChange: 0
          };
        })
    );
    annotationsWithImpact.sort((a, b) => b.date.localeCompare(a.date));


    // 7. Calculate recently updated keywords (position changes on maxDateStr vs prevDateStr)
    const recentlyUpdatedKeywords: any[] = [];
    if (maxDateStr) {
      let prevDateStr = '';
      const rankingsDir = path.join(process.cwd(), '.data', 'rankings', projectId);
      if (fs.existsSync(rankingsDir)) {
        const files = fs.readdirSync(rankingsDir)
          .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
          .map(f => f.replace('.json', ''))
          .sort();
        const asOfIdx = files.indexOf(maxDateStr);
        if (asOfIdx > 0) {
          prevDateStr = files[asOfIdx - 1];
        } else if (files.length > 0) {
          const lastIdx = files.indexOf(files[files.length - 1]);
          if (lastIdx > 0) {
            prevDateStr = files[lastIdx - 1];
          }
        }
      }

      const [currentRankingsOnSyncDate, previousRankingsOnSyncDate] = await Promise.all([
        store.getRankingsInRange(projectId, maxDateStr, maxDateStr),
        prevDateStr ? store.getRankingsInRange(projectId, prevDateStr, prevDateStr) : Promise.resolve([])
      ]);

      const prevRankMap = new Map<string, number>();
      previousRankingsOnSyncDate.forEach(r => prevRankMap.set(r.keyword_id, r.position));

      currentRankingsOnSyncDate.forEach(r => {
        const kw = allKeywords.find(k => k.id === r.keyword_id);
        if (!kw) return;
        
        // Filter out skipped keywords
        const kwLower = kw.keyword.toLowerCase();
        const isCustomSkipped = skipKeywordsLower.some(pattern => 
          kwLower === pattern || kwLower.includes(pattern)
        );
        if (isCustomSkipped) return;
        if (hideExcluded && kw.is_excluded) return;
        if (category !== 'All' && kw.category !== category) return;
        if (country !== 'All' && kw.country !== country) return;
        if (queryFilter && !matchesFilter(kw.keyword, queryFilter, queryFilterType)) return;

        const prevPos = prevRankMap.get(r.keyword_id);
        const curPos = r.position;

        if (prevPos !== undefined) {
          const diff = prevPos - curPos;
          if (Math.abs(diff) >= 0.1) {
            recentlyUpdatedKeywords.push({
              keywordId: kw.id,
              keyword: kw.keyword,
              country: kw.country,
              category: kw.category,
              prevPosition: Math.round(prevPos * 10) / 10,
              currentPosition: Math.round(curPos * 10) / 10,
              change: Math.round(diff * 10) / 10, // positive is improvement
              clicks: r.clicks,
              impressions: r.impressions,
              ctr: r.ctr
            });
          }
        } else {
          // New keyword ranked today
          recentlyUpdatedKeywords.push({
            keywordId: kw.id,
            keyword: kw.keyword,
            country: kw.country,
            category: kw.category,
            prevPosition: null,
            currentPosition: Math.round(curPos * 10) / 10,
            change: null, // "New"
            clicks: r.clicks,
            impressions: r.impressions,
            ctr: r.ctr
          });
        }
      });

      // Sort: largest absolute change / new keywords first
      recentlyUpdatedKeywords.sort((a, b) => {
        if (a.change === null && b.change !== null) return -1;
        if (a.change !== null && b.change === null) return 1;
        if (a.change !== null && b.change !== null) {
          return Math.abs(b.change) - Math.abs(a.change);
        }
        return b.impressions - a.impressions;
      });
    }

    const mainBody = {
      kpis,
      chartData,
      keywords: tableKeywords,
      pages: tablePages,
      countries: tableCountries,
      devices: tableDevices,
      searchAppearances: tableAppearances,
      days: tableDays,
      cannibalized: cannibalizedList,
      brandedSplit,
      googleUpdates: googleUpdatesWithImpact,
      annotations: annotationsWithImpact,
      countriesList,
      asOfDate: maxDateStr,
      recentlyUpdatedKeywords: recentlyUpdatedKeywords.slice(0, 30) // limit to top 30
    };
    setDashboardCache(cacheKey, mainBody);
    return NextResponse.json(mainBody);

  } catch (error: any) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
