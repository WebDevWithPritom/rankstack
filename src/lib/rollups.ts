import { KeywordRollup, Ranking, ChangeLog } from './types';
import * as store from './store';

/**
 * Computes or rebuilds rollups for all keywords in a project.
 * Uses the maximum ranking date as the anchor (or today - 2 days if no rankings).
 */
export async function computeProjectRollups(projectId: string): Promise<{
  rollupsCount: number;
  changesCount: number;
}> {
  // 1. Fetch data
  const keywords = await store.getKeywords(projectId);
  const rankings = await store.getRankings(projectId);
  const previousRollups = await store.getRollups(projectId);

  if (keywords.length === 0 || rankings.length === 0) {
    return { rollupsCount: 0, changesCount: 0 };
  }

  // 2. Determine anchor date (as_of_date)
  let maxDateStr = '';
  for (const r of rankings) {
    if (r.date > maxDateStr) {
      maxDateStr = r.date;
    }
  }

  if (!maxDateStr) {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    maxDateStr = twoDaysAgo.toISOString().split('T')[0];
  }

  const asOfDate = new Date(maxDateStr);

  // Group rankings by keyword_id for fast lookup
  const rankingByKeywordMap = new Map<string, Ranking[]>();
  for (const r of rankings) {
    const list = rankingByKeywordMap.get(r.keyword_id) || [];
    list.push(r);
    rankingByKeywordMap.set(r.keyword_id, list);
  }

  // Group previous rollups by keyword_id
  const prevRollupMap = new Map<string, KeywordRollup>();
  for (const pr of previousRollups) {
    prevRollupMap.set(pr.keyword_id, pr);
  }

  const newRollups: KeywordRollup[] = [];
  const changeLogsToAppend: ChangeLog[] = [];
  const nowStr = new Date().toISOString();

  // Helper to add day offset to a date string
  function getOffsetDateStr(anchorStr: string, daysOffset: number): string {
    const d = new Date(anchorStr);
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split('T')[0];
  }

  // Define date thresholds
  const date1d = maxDateStr;
  const date1dAgo = getOffsetDateStr(maxDateStr, -1);
  const date7dAgo = getOffsetDateStr(maxDateStr, -7);
  const date30dAgo = getOffsetDateStr(maxDateStr, -30);

  // Define window start dates (inclusive)
  const start7d = getOffsetDateStr(maxDateStr, -6);
  const start30d = getOffsetDateStr(maxDateStr, -29);
  const start90d = getOffsetDateStr(maxDateStr, -89);
  const start365d = getOffsetDateStr(maxDateStr, -364);

  for (const keyword of keywords) {
    // Skip excluded keywords if we don't want to rollup, but standard is to rollup anyway unless filter applies.
    // Let's compute rollups for all keywords.
    const kwRankings = rankingByKeywordMap.get(keyword.id) || [];
    if (kwRankings.length === 0) continue;

    // Filter rankings within 365 days window ending at maxDateStr
    const activeRankings = kwRankings.filter(r => r.date <= maxDateStr && r.date >= start365d);
    if (activeRankings.length === 0) continue;

    // Sort active rankings by date descending for position_latest
    activeRankings.sort((a, b) => b.date.localeCompare(a.date));

    // Find ranking on maxDateStr if exists, otherwise fallback to the most recent ranking in activeRankings
    const latestRanking = activeRankings.find(r => r.date === maxDateStr) || activeRankings[0];
    const positionLatest = latestRanking.position;

    // Calculate sum of clicks/impressions in various windows
    let clicks_1d = 0;
    let impressions_1d = 0;
    let clicks_7d = 0;
    let impressions_7d = 0;
    let clicks_30d = 0;
    let impressions_30d = 0;
    let clicks_90d = 0;
    let impressions_90d = 0;
    let clicks_365d = 0;
    let impressions_365d = 0;

    // Tracking URLs and their impressions inside the 30-day window (fallback to 90/365 if none)
    const urlImpressions: Record<string, number> = {};

    for (const r of activeRankings) {
      const date = r.date;
      const clicks = r.clicks;
      const impressions = r.impressions;
      const url = r.ranking_url;

      // Clicks & impressions by window
      if (date === date1d) {
        clicks_1d += clicks;
        impressions_1d += impressions;
      }
      if (date >= start7d) {
        clicks_7d += clicks;
        impressions_7d += impressions;
      }
      if (date >= start30d) {
        clicks_30d += clicks;
        impressions_30d += impressions;
      }
      if (date >= start90d) {
        clicks_90d += clicks;
        impressions_90d += impressions;
      }
      clicks_365d += clicks;
      impressions_365d += impressions;

      // Track URL impressions (for ranking_url_latest, we use the URL with the max impressions in the last 30 days)
      if (url) {
        urlImpressions[url] = (urlImpressions[url] || 0) + impressions;
      }
    }

    // Determine ranking_url_latest (URL with max impressions)
    let rankingUrlLatest = latestRanking.ranking_url || '';
    let maxImps = -1;
    for (const [url, imps] of Object.entries(urlImpressions)) {
      if (imps > maxImps) {
        maxImps = imps;
        rankingUrlLatest = url;
      }
    }

    // Find position at offset dates (1d ago, 7d ago, 30d ago)
    const rank1dAgo = kwRankings.find(r => r.date === date1dAgo);
    const rank7dAgo = kwRankings.find(r => r.date === date7dAgo);
    const rank30dAgo = kwRankings.find(r => r.date === date30dAgo);

    // Change defined as previous_position - current_position (so a positive number represents improvement, e.g. from 10 to 3 is +7)
    const change_1d = rank1dAgo ? (rank1dAgo.position - positionLatest) : 0;
    const change_7d = rank7dAgo ? (rank7dAgo.position - positionLatest) : 0;
    const change_30d = rank30dAgo ? (rank30dAgo.position - positionLatest) : 0;

    const rollup: KeywordRollup = {
      keyword_id: keyword.id,
      as_of_date: maxDateStr,
      position_latest: Math.round(positionLatest * 100) / 100,
      clicks_1d,
      clicks_7d,
      clicks_30d,
      clicks_90d,
      clicks_365d,
      impressions_1d,
      impressions_7d,
      impressions_30d,
      impressions_90d,
      impressions_365d,
      change_1d: Math.round(change_1d * 100) / 100,
      change_7d: Math.round(change_7d * 100) / 100,
      change_30d: Math.round(change_30d * 100) / 100,
      ranking_url_latest: rankingUrlLatest
    };

    newRollups.push(rollup);

    // 3. Compare with previous rollup to generate ChangeLogs
    const prevRollup = prevRollupMap.get(keyword.id);
    if (prevRollup) {
      const compareMetrics: Array<{
        type: ChangeLog['metric_type'];
        oldVal: number;
        newVal: number;
      }> = [
        { type: 'position', oldVal: prevRollup.position_latest, newVal: rollup.position_latest },
        { type: 'clicks_30d', oldVal: prevRollup.clicks_30d, newVal: rollup.clicks_30d },
        { type: 'clicks_90d', oldVal: prevRollup.clicks_90d, newVal: rollup.clicks_90d },
        { type: 'impressions_30d', oldVal: prevRollup.impressions_30d, newVal: rollup.impressions_30d },
        { type: 'impressions_90d', oldVal: prevRollup.impressions_90d, newVal: rollup.impressions_90d }
      ];

      for (const m of compareMetrics) {
        if (m.oldVal !== m.newVal) {
          changeLogsToAppend.push({
            id: `chg_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
            project_id: projectId,
            keyword_id: keyword.id,
            date: maxDateStr,
            metric_type: m.type,
            old_value: m.oldVal,
            new_value: m.newVal,
            created_at: nowStr
          });
        }
      }
    }
  }

  // 4. Save results to local storage
  await store.saveRollups(projectId, newRollups);
  if (changeLogsToAppend.length > 0) {
    await store.addChangeLogs(changeLogsToAppend);
  }

  return {
    rollupsCount: newRollups.length,
    changesCount: changeLogsToAppend.length
  };
}
