/**
 * Server-side in-memory response cache for the dashboard API.
 * Stored in a module-level singleton so it persists across requests
 * within the same Node.js process (i.e. the Next.js dev/prod server).
 *
 * TTL: 3 minutes per unique filter combination.
 * Max entries: 200 (LRU eviction of oldest).
 */

const _cache = new Map<string, { ts: number; body: any }>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

export function getDashboardCache(key: string): any | null {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return entry.body;
}

export function setDashboardCache(key: string, body: any): void {
  // Evict oldest entry when limit is reached
  if (_cache.size >= 200) {
    const oldest = Array.from(_cache.entries()).sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) _cache.delete(oldest[0]);
  }
  _cache.set(key, { ts: Date.now(), body });
}

/**
 * Bust all cache entries for a given project (e.g. after a sync).
 * If no projectId is provided, the entire cache is cleared.
 */
export function bustDashboardCache(projectId?: string): void {
  if (projectId) {
    for (const key of Array.from(_cache.keys())) {
      if (key.includes(projectId)) _cache.delete(key);
    }
  } else {
    _cache.clear();
  }
}
