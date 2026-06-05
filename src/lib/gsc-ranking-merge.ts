import { Ranking } from './types';

interface RawRankingInput {
  keyword_id: string;
  date: string;
  position: number;
  clicks: number;
  impressions: number;
  ranking_url: string;
}

/**
 * Merges duplicate landing page ranking entries for the same keyword_id + date.
 * - Sums clicks and impressions.
 * - Computes impression-weighted average position.
 * - Picks the page/ranking_url that received the most impressions.
 */
export function mergeGSCRankings(rawRankings: RawRankingInput[]): Ranking[] {
  const mergedMap = new Map<string, {
    keyword_id: string;
    date: string;
    clicks: number;
    impressions: number;
    weightedPositionSum: number;
    urlImpressionsMap: Record<string, number>;
  }>();

  for (const row of rawRankings) {
    const key = `${row.keyword_id}||${row.date}`;
    const existing = mergedMap.get(key);

    if (existing) {
      existing.clicks += row.clicks;
      existing.impressions += row.impressions;
      existing.weightedPositionSum += row.position * row.impressions;
      existing.urlImpressionsMap[row.ranking_url] = (existing.urlImpressionsMap[row.ranking_url] || 0) + row.impressions;
    } else {
      mergedMap.set(key, {
        keyword_id: row.keyword_id,
        date: row.date,
        clicks: row.clicks,
        impressions: row.impressions,
        weightedPositionSum: row.position * row.impressions,
        urlImpressionsMap: { [row.ranking_url]: row.impressions }
      });
    }
  }

  const mergedRankings: Ranking[] = [];

  mergedMap.forEach((data) => {
    // 1. Calculate weighted position
    let finalPosition = 1;
    if (data.impressions > 0) {
      finalPosition = data.weightedPositionSum / data.impressions;
    } else {
      // Fallback if impressions are 0 (e.g. mock data or rare GSC anomaly)
      const matchingRows = rawRankings.filter(r => r.keyword_id === data.keyword_id && r.date === data.date);
      if (matchingRows.length > 0) {
        const sumPos = matchingRows.reduce((sum, r) => sum + r.position, 0);
        finalPosition = sumPos / matchingRows.length;
      }
    }

    // Round position to 2 decimal places for storage neatness
    finalPosition = Math.round(finalPosition * 100) / 100;

    // 2. Calculate CTR
    const finalCtr = data.impressions > 0 ? (data.clicks / data.impressions) : 0;

    // 3. Find URL with maximum impressions
    let bestUrl = '';
    let maxImpressions = -1;
    for (const [url, imps] of Object.entries(data.urlImpressionsMap)) {
      if (imps > maxImpressions) {
        maxImpressions = imps;
        bestUrl = url;
      }
    }

    mergedRankings.push({
      keyword_id: data.keyword_id,
      date: data.date,
      position: finalPosition,
      clicks: data.clicks,
      impressions: data.impressions,
      ctr: Math.round(finalCtr * 10000) / 10000, // Round to 4 decimal places (e.g. 0.1234 = 12.34%)
      ranking_url: bestUrl,
      source: 'gsc'
    });
  });

  return mergedRankings;
}
