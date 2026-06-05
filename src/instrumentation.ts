/**
 * Next.js Instrumentation Hook
 * Runs once when the Node.js server process starts.
 * Pre-warms the local DB cache and builds the ranking date-index
 * so that the very first dashboard request is served from memory
 * instead of reading and parsing the JSON file mid-request.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run in Node.js (not Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { readDb, getRankingsInRange } = await import('@/lib/store/local-db');
      
      // 1. Load and cache the DB
      const db = await readDb();
      console.log(
        `[RankStack] DB pre-warmed: ` +
        `${db.keywords.length} keywords, ${db.property_totals?.length ?? 0} property totals`
      );

      // 2. Trigger a range query to force the date index to build now
      //    (pick the first project, any date range — just to warm the index)
      if (db.projects.length > 0) {
        const projectId = db.projects[0].id;
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 86400_000).toISOString().split('T')[0];
        await getRankingsInRange(projectId, startDate, endDate);
        console.log('[RankStack] Date index built — dashboard requests will be fast.');
      }
    } catch (err) {
      // Non-fatal: the index will be built on the first API request instead
      console.warn('[RankStack] Startup pre-warm skipped:', err);
    }
  }
}
