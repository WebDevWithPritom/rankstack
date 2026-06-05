import fs from 'fs';
import path from 'path';
import {
  LocalStoreData,
  Project,
  Keyword,
  Ranking,
  KeywordRollup,
  Integration,
  SyncJob,
  ChangeLog,
  SyncSkipped,
  SyncLog,
  ProjectMeta,
  MarketData,
  PropertyTotal,
  Annotation
} from '../types';

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'rankstack.json');

// Initialize database with default structure if it doesn't exist
const DEFAULT_DATA: LocalStoreData = {
  projects: [],
  keywords: [],
  rankings: [],
  integrations: [],
  sync_logs: [],
  sync_jobs: [],
  rollups: [],
  change_log: [],
  sync_skipped: [],
  project_meta: [],
  market: [],
  property_totals: [],
  annotations: []
};


// Write queue to prevent race conditions during concurrent requests
let writeQueue = Promise.resolve();
let cachedDb: LocalStoreData | null = null;

// ---------------------------------------------------------------------------
// Memory cache for rankings: Map<projectId, Map<date, Ranking[]>>
// ---------------------------------------------------------------------------
const rankingsMemoryCache = new Map<string, Map<string, Ranking[]>>();

function loadRankingsForDate(projectId: string, date: string): Ranking[] {
  let projCache = rankingsMemoryCache.get(projectId);
  if (!projCache) {
    projCache = new Map();
    rankingsMemoryCache.set(projectId, projCache);
  }

  if (projCache.has(date)) {
    return projCache.get(date) || [];
  }

  const filePath = path.join(DATA_DIR, 'rankings', projectId, `${date}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const list = JSON.parse(content) as Ranking[];
      projCache.set(date, list);
      return list;
    } catch (e) {
      console.error(`Failed to parse rankings file for ${projectId} / ${date}:`, e);
      return [];
    }
  }

  projCache.set(date, []);
  return [];
}

function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  fs.mkdirSync(dirname, { recursive: true });
}

export async function readDb(): Promise<LocalStoreData> {
  if (cachedDb) {
    return cachedDb;
  }
  try {
    ensureDirectoryExistence(DATA_FILE);
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA), 'utf8');
      cachedDb = DEFAULT_DATA;
      return DEFAULT_DATA;
    }
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    if (!content.trim()) {
      cachedDb = DEFAULT_DATA;
      return DEFAULT_DATA;
    }
    const parsed = JSON.parse(content) as LocalStoreData;
    // Merge with defaults to ensure all arrays exist
    cachedDb = {
      ...DEFAULT_DATA,
      ...parsed,
      property_totals: parsed.property_totals || [],
      annotations: parsed.annotations || []
    };

    // --- Automatic Migration: Move rankings from single JSON to date-based files ---
    if (cachedDb.rankings && cachedDb.rankings.length > 0) {
      console.log(`[RankStack Migration] Starting migration of ${cachedDb.rankings.length} rankings to date-based files...`);
      
      // Map keywordId -> projectId
      const kwProjectMap = new Map<string, string>();
      cachedDb.keywords.forEach(k => kwProjectMap.set(k.id, k.project_id));
      
      // Group rankings by projectId and date
      const grouped = new Map<string, Map<string, Ranking[]>>();
      for (const r of cachedDb.rankings) {
        const pid = kwProjectMap.get(r.keyword_id);
        if (!pid) continue;
        let byDate = grouped.get(pid);
        if (!byDate) {
          byDate = new Map();
          grouped.set(pid, byDate);
        }
        let list = byDate.get(r.date);
        if (!list) {
          list = [];
          byDate.set(r.date, list);
        }
        list.push(r);
      }
      
      // Write each group to its date-based file
      grouped.forEach((byDate, pid) => {
        const projDir = path.join(DATA_DIR, 'rankings', pid);
        if (!fs.existsSync(projDir)) {
          fs.mkdirSync(projDir, { recursive: true });
        }
        byDate.forEach((list, date) => {
          const filePath = path.join(projDir, `${date}.json`);
          fs.writeFileSync(filePath, JSON.stringify(list), 'utf8');
        });
      });
      
      console.log('[RankStack Migration] All rankings migrated successfully.');
      
      // Clear rankings from main DB to shrink the file
      cachedDb.rankings = [];
      // Write cleared DB back to disk synchronously to avoid concurrent issues
      fs.writeFileSync(DATA_FILE, JSON.stringify(cachedDb), 'utf8');
      console.log('[RankStack Migration] Main database file cleared of rankings and shrunk.');
    }
    // ---------------------------------------------------------------------------

    return cachedDb;
  } catch (error) {
    console.error('Failed to read local DB file:', error);
    return DEFAULT_DATA;
  }
}

export async function writeDb(data: LocalStoreData): Promise<void> {
  cachedDb = data; // Update memory cache instantly
  writeQueue = writeQueue.then(async () => {
    try {
      ensureDirectoryExistence(DATA_FILE);
      // Ensure we never write rankings array back to disk (rankings are split out)
      const dataToSave = {
        ...data,
        rankings: []
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave), 'utf8');
    } catch (error) {
      console.error('Failed to write local DB file:', error);
    }
  });
  return writeQueue;
}

// ==========================================
// Projects
// ==========================================
export async function getProjects(): Promise<Project[]> {
  const db = await readDb();
  return db.projects;
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await readDb();
  return db.projects.find(p => p.id === id);
}

export async function createProject(project: Project): Promise<Project> {
  const db = await readDb();
  db.projects.push(project);
  await writeDb(db);
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  const db = await readDb();
  db.projects = db.projects.filter(p => p.id !== id);
  // Cascade delete related entities
  const keywordsToDelete = db.keywords.filter(k => k.project_id === id).map(k => k.id);
  db.keywords = db.keywords.filter(k => k.project_id !== id);
  db.rollups = db.rollups.filter(r => !keywordsToDelete.includes(r.keyword_id));
  db.integrations = db.integrations.filter(i => i.project_id !== id);
  db.sync_logs = db.sync_logs.filter(l => l.project_id !== id);
  db.sync_jobs = db.sync_jobs.filter(j => j.project_id !== id);
  db.change_log = db.change_log.filter(c => c.project_id !== id);
  db.sync_skipped = db.sync_skipped.filter(s => s.project_id !== id);
  db.project_meta = db.project_meta.filter(m => m.project_id !== id);
  db.market = db.market.filter(m => m.project_id !== id);
  db.property_totals = (db.property_totals || []).filter(t => t.project_id !== id);
  db.annotations = (db.annotations || []).filter(a => a.project_id !== id);

  // Clear from cache
  rankingsMemoryCache.delete(id);

  // Delete rankings folder
  const projDir = path.join(DATA_DIR, 'rankings', id);
  if (fs.existsSync(projDir)) {
    try {
      fs.rmSync(projDir, { recursive: true, force: true });
    } catch (e) {
      console.error(`Failed to delete rankings directory for project ${id}:`, e);
    }
  }

  await writeDb(db);
}

// ==========================================
// Keywords
// ==========================================
export async function getKeywords(projectId: string): Promise<Keyword[]> {
  const db = await readDb();
  return db.keywords.filter(k => k.project_id === projectId);
}

export async function updateKeyword(keyword: Keyword): Promise<Keyword> {
  const db = await readDb();
  db.keywords = db.keywords.map(k => k.id === keyword.id ? keyword : k);
  await writeDb(db);
  return keyword;
}

// Helper to auto-tag keywords based on text patterns
export function autoTagKeyword(keyword: string, domain: string, projectName: string): { category: string; intent: string } {
  const kw = keyword.toLowerCase();
  
  let brand = projectName.toLowerCase();
  if (domain) {
    const match = domain.replace(/https?:\/\/(www\.)?/, '').split('.')[0];
    if (match) brand = match.toLowerCase();
  }

  let category = 'Blog'; // default
  let intent = 'Informational';

  if (kw.includes(brand) || kw.includes('wpoet')) {
    category = 'Branded';
    intent = 'Navigational';
  } else if (kw.includes('migrate') || kw.includes('migration') || kw.includes('redirect') || kw.includes('transfer')) {
    category = 'Migration';
    intent = 'Transactional';
  } else if (kw.includes('near me') || kw.includes('location') || kw.includes('mumbai') || kw.includes('india') || kw.includes('delhi') || kw.includes('address') || kw.includes('office')) {
    category = 'Location';
    intent = 'Navigational';
  } else if (kw.includes('service') || kw.includes('agency') || kw.includes('pricing') || kw.includes('cost') || kw.includes('hire') || kw.includes('company') || kw.includes('developer') || kw.includes('consult') || kw.includes('expert')) {
    category = 'Service';
    intent = 'Commercial';
  } else if (kw.includes('how') || kw.includes('what') || kw.includes('why') || kw.includes('guide') || kw.includes('tips') || kw.includes('best') || kw.includes('review') || kw.includes('vs') || kw.includes('tutorial')) {
    category = 'Blog';
    intent = 'Informational';
  }

  return { category, intent };
}

// Batch ensure keywords exist to map query+country keys efficiently
export async function ensureKeywords(
  projectId: string,
  queriesAndCountries: Array<{ keyword: string; country: string }>
): Promise<Keyword[]> {
  const db = await readDb();
  const project = db.projects.find(p => p.id === projectId);
  const existingMap = new Map<string, Keyword>();
  
  db.keywords
    .filter(k => k.project_id === projectId)
    .forEach(k => {
      existingMap.set(`${k.keyword.toLowerCase()}||${k.country.toUpperCase()}`, k);
    });

  const now = new Date().toISOString();
  let dbModified = false;
  const result: Keyword[] = [];

  for (const item of queriesAndCountries) {
    const key = `${item.keyword.toLowerCase()}||${item.country.toUpperCase()}`;
    let kw = existingMap.get(key);
    if (!kw) {
      const { category, intent } = autoTagKeyword(item.keyword, project?.domain || '', project?.name || '');
      kw = {
        id: `kw_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
        project_id: projectId,
        keyword: item.keyword,
        country: item.country.toUpperCase(),
        category,
        intent,
        is_excluded: false,
        created_at: now,
        updated_at: now
      };
      db.keywords.push(kw);
      existingMap.set(key, kw);
      dbModified = true;
    }
    result.push(kw);
  }

  if (dbModified) {
    await writeDb(db);
  }

  return result;
}

// ==========================================
// Rankings
// ==========================================
export async function getRankings(projectId: string): Promise<Ranking[]> {
  const projDir = path.join(DATA_DIR, 'rankings', projectId);
  if (!fs.existsSync(projDir)) return [];

  const result: Ranking[] = [];
  try {
    const files = fs.readdirSync(projDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const date = file.replace('.json', '');
        const rows = loadRankingsForDate(projectId, date);
        result.push(...rows);
      }
    }
  } catch (e) {
    console.error(`Failed to read rankings directory for project ${projectId}:`, e);
  }
  return result;
}

export async function getRankingsInRange(
  projectId: string,
  startDate: string,
  endDate: string
): Promise<Ranking[]> {
  const result: Ranking[] = [];
  const cursor = new Date(startDate);
  const end = new Date(endDate);

  while (cursor <= end) {
    const dateStr = cursor.toISOString().split('T')[0];
    const rows = loadRankingsForDate(projectId, dateStr);
    result.push(...rows);
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

/**
 * Returns the most recent YYYY-MM-DD for which ranking data files exist.
 * Cheap O(n filenames) directory scan — no file reads required.
 * Used by the dashboard to anchor the 24H/7D windows when a category filter is
 * active (usePropertyTotals=false) so we never query a date newer than the data.
 */
export function getMaxRankingDate(projectId: string): string {
  const projDir = path.join(DATA_DIR, 'rankings', projectId);
  if (!fs.existsSync(projDir)) return '';
  try {
    const files = fs.readdirSync(projDir)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map(f => f.replace('.json', ''))
      .sort();
    return files.length > 0 ? files[files.length - 1] : '';
  } catch {
    return '';
  }
}

export async function saveRankings(projectId: string, rankings: Ranking[]): Promise<void> {
  // Group rankings by date
  const byDate = new Map<string, Ranking[]>();
  for (const r of rankings) {
    let list = byDate.get(r.date);
    if (!list) {
      list = [];
      byDate.set(r.date, list);
    }
    list.push(r);
  }

  const projCache = rankingsMemoryCache.get(projectId) || new Map<string, Ranking[]>();
  if (!rankingsMemoryCache.has(projectId)) {
    rankingsMemoryCache.set(projectId, projCache);
  }

  const projDir = path.join(DATA_DIR, 'rankings', projectId);
  if (!fs.existsSync(projDir)) {
    fs.mkdirSync(projDir, { recursive: true });
  }

  byDate.forEach((newRows, date) => {
    const existingRows = loadRankingsForDate(projectId, date);

    // Merge & deduplicate: newRows overrides existing on keyword_id + source
    const mergedMap = new Map<string, Ranking>();
    for (const r of existingRows) {
      mergedMap.set(`${r.keyword_id}||${r.source}`, r);
    }
    for (const r of newRows) {
      mergedMap.set(`${r.keyword_id}||${r.source}`, r);
    }

    const mergedList = Array.from(mergedMap.values());
    projCache.set(date, mergedList);

    const filePath = path.join(projDir, `${date}.json`);
    fs.writeFileSync(filePath, JSON.stringify(mergedList), 'utf8');
  });
}

// ==========================================
// Integrations
// ==========================================
export async function getIntegrations(projectId: string): Promise<Integration[]> {
  const db = await readDb();
  return db.integrations.filter(i => i.project_id === projectId);
}

export async function getIntegration(projectId: string, type: 'gsc' | 'serpapi' | 'dataforseo'): Promise<Integration | undefined> {
  const db = await readDb();
  return db.integrations.find(i => i.project_id === projectId && i.type === type);
}

export async function saveIntegration(integration: Integration): Promise<Integration> {
  const db = await readDb();
  const index = db.integrations.findIndex(
    i => i.project_id === integration.project_id && i.type === integration.type
  );
  const now = new Date().toISOString();
  const newIntegration = {
    ...integration,
    updated_at: now,
    created_at: index >= 0 ? db.integrations[index].created_at || now : now
  };

  if (index >= 0) {
    db.integrations[index] = newIntegration;
  } else {
    db.integrations.push(newIntegration);
  }
  await writeDb(db);
  return newIntegration;
}

export async function deleteIntegration(projectId: string, type: 'gsc' | 'serpapi' | 'dataforseo'): Promise<void> {
  const db = await readDb();
  db.integrations = db.integrations.filter(i => !(i.project_id === projectId && i.type === type));
  await writeDb(db);
}

// ==========================================
// Rollups
// ==========================================
export async function getRollups(projectId: string): Promise<KeywordRollup[]> {
  const db = await readDb();
  const kwIds = new Set(db.keywords.filter(k => k.project_id === projectId).map(k => k.id));
  return db.rollups.filter(r => kwIds.has(r.keyword_id));
}

export async function saveRollups(projectId: string, rollups: KeywordRollup[]): Promise<void> {
  const db = await readDb();
  const kwIds = new Set(db.keywords.filter(k => k.project_id === projectId).map(k => k.id));

  // Remove existing rollups for this project
  db.rollups = db.rollups.filter(r => !kwIds.has(r.keyword_id));
  db.rollups.push(...rollups);
  await writeDb(db);
}

// ==========================================
// Sync Jobs
// ==========================================
export async function getSyncJobs(projectId: string): Promise<SyncJob[]> {
  const db = await readDb();
  return db.sync_jobs.filter(j => j.project_id === projectId);
}

export async function getSyncJob(jobId: string): Promise<SyncJob | undefined> {
  const db = await readDb();
  return db.sync_jobs.find(j => j.id === jobId);
}

export async function saveSyncJob(job: SyncJob): Promise<SyncJob> {
  const db = await readDb();
  const index = db.sync_jobs.findIndex(j => j.id === job.id);
  if (index >= 0) {
    db.sync_jobs[index] = job;
  } else {
    db.sync_jobs.push(job);
  }
  await writeDb(db);
  return job;
}

// ==========================================
// Change Logs
// ==========================================
export async function getChangeLogs(projectId: string): Promise<ChangeLog[]> {
  const db = await readDb();
  return db.change_log.filter(c => c.project_id === projectId);
}

export async function addChangeLogs(changeLogs: ChangeLog[]): Promise<void> {
  if (changeLogs.length === 0) return;
  const db = await readDb();
  db.change_log.push(...changeLogs);
  // Cap change log at latest 10000 entries per project
  await writeDb(db);
}

// ==========================================
// Sync Skipped
// ==========================================
export async function getSyncSkipped(projectId: string): Promise<SyncSkipped[]> {
  const db = await readDb();
  return db.sync_skipped.filter(s => s.project_id === projectId);
}

export async function addSyncSkipped(skipped: SyncSkipped[]): Promise<void> {
  if (skipped.length === 0) return;
  const db = await readDb();
  db.sync_skipped.push(...skipped);
  await writeDb(db);
}

// ==========================================
// Sync Logs
// ==========================================
export async function getSyncLogs(projectId: string): Promise<SyncLog[]> {
  const db = await readDb();
  return db.sync_logs.filter(l => l.project_id === projectId);
}

export async function addSyncLog(log: SyncLog): Promise<SyncLog> {
  const db = await readDb();
  db.sync_logs.push(log);
  // Cap logs to last 50
  const projectLogs = db.sync_logs.filter(l => l.project_id === log.project_id);
  if (projectLogs.length > 50) {
    const keepIds = new Set(projectLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50).map(l => l.id));
    db.sync_logs = db.sync_logs.filter(l => l.project_id !== log.project_id || keepIds.has(l.id));
  }
  await writeDb(db);
  return log;
}

// ==========================================
// Project Meta
// ==========================================
export async function getProjectMeta(projectId: string): Promise<ProjectMeta[]> {
  const db = await readDb();
  return db.project_meta.filter(m => m.project_id === projectId);
}

export async function setProjectMeta(projectId: string, key: string, value: string): Promise<void> {
  const db = await readDb();
  const index = db.project_meta.findIndex(m => m.project_id === projectId && m.key === key);
  if (index >= 0) {
    db.project_meta[index].value = value;
  } else {
    db.project_meta.push({ project_id: projectId, key, value });
  }
  await writeDb(db);
}

// ==========================================
// Market Data
// ==========================================
export async function getMarketData(projectId: string): Promise<MarketData[]> {
  const db = await readDb();
  return db.market.filter(m => m.project_id === projectId);
}

export async function saveMarketData(projectId: string, marketData: MarketData[]): Promise<void> {
  const db = await readDb();
  const kwIds = new Set(db.keywords.filter(k => k.project_id === projectId).map(k => k.id));
  db.market = db.market.filter(m => !kwIds.has(m.keyword_id));
  db.market.push(...marketData);
  await writeDb(db);
}

// ==========================================
// Property Totals
// ==========================================
export async function getPropertyTotals(projectId: string): Promise<PropertyTotal[]> {
  const db = await readDb();
  return (db.property_totals || []).filter(t => t.project_id === projectId);
}

export async function savePropertyTotals(projectId: string, totals: PropertyTotal[]): Promise<void> {
  const db = await readDb();
  if (!db.property_totals) {
    db.property_totals = [];
  }

  // Remove existing property totals for this project and the matching dates and countries to avoid duplicates
  const keysToSave = new Set(
    totals.map(t => `${t.date}||${t.country.toUpperCase()}`)
  );

  db.property_totals = db.property_totals.filter(t => {
    if (t.project_id !== projectId) return true;
    const key = `${t.date}||${t.country.toUpperCase()}`;
    return !keysToSave.has(key);
  });

  // Append new totals
  db.property_totals.push(...totals);
  await writeDb(db);
}

// ==========================================
// Annotations
// ==========================================
export async function getAnnotations(projectId: string): Promise<Annotation[]> {
  const db = await readDb();
  return (db.annotations || []).filter(a => a.project_id === projectId);
}

export async function saveAnnotation(annotation: Annotation): Promise<Annotation> {
  const db = await readDb();
  if (!db.annotations) {
    db.annotations = [];
  }
  const index = db.annotations.findIndex(a => a.id === annotation.id);
  if (index >= 0) {
    db.annotations[index] = annotation;
  } else {
    db.annotations.push(annotation);
  }
  await writeDb(db);
  return annotation;
}

export async function deleteAnnotation(projectId: string, id: string): Promise<void> {
  const db = await readDb();
  if (!db.annotations) return;
  db.annotations = db.annotations.filter(a => !(a.project_id === projectId && a.id === id));
  await writeDb(db);
}

