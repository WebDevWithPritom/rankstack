export interface Project {
  id: string;
  name: string;
  domain: string;
  created_at: string;
}

export interface Keyword {
  id: string;
  project_id: string;
  keyword: string;
  country: string; // ISO-2 code (e.g. IN, US)
  device?: string;
  intent?: string;
  category?: string;
  is_excluded: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ranking {
  keyword_id: string;
  date: string; // YYYY-MM-DD
  position: number;
  clicks: number;
  impressions: number;
  ctr: number;
  ranking_url: string;
  source: 'gsc' | 'serpapi' | 'dataforseo';
}

export interface KeywordRollup {
  keyword_id: string;
  as_of_date: string; // YYYY-MM-DD
  position_latest: number;
  clicks_1d: number;
  clicks_7d: number;
  clicks_30d: number;
  clicks_90d: number;
  clicks_365d: number;
  impressions_1d: number;
  impressions_7d: number;
  impressions_30d: number;
  impressions_90d: number;
  impressions_365d: number;
  change_1d: number; // current - previous
  change_7d: number;
  change_30d: number;
  ranking_url_latest: string;
}

export interface Integration {
  project_id: string;
  type: 'gsc' | 'serpapi' | 'dataforseo';
  api_key?: string; // encrypted
  metadata?: string; // encrypted JSON for oauth tokens
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SyncJob {
  id: string;
  project_id: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  months_done: number;
  total_months: number;
  next_month: string; // YYYY-MM
  created_at: string;
  updated_at: string;
}

export interface ChangeLog {
  id: string;
  project_id: string;
  keyword_id: string;
  date: string;
  metric_type: 'position' | 'clicks_30d' | 'clicks_90d' | 'impressions_30d' | 'impressions_90d';
  old_value: number;
  new_value: number;
  created_at: string;
}

export interface SyncSkipped {
  id: string;
  project_id: string;
  date: string;
  keyword: string;
  country: string;
  reason: string;
  clicks?: number;
  impressions?: number;
}

export interface SyncLog {
  id: string;
  project_id: string;
  date: string;
  status: 'success' | 'failed' | 'running';
  message: string;
  details?: string;
  type: 'quick' | 'daily' | '90d' | 'backfill' | 'rebuild' | 'verify';
  created_at: string;
}

export interface ProjectMeta {
  project_id: string;
  key: string;
  value: string;
}

export interface MarketData {
  id: string;
  project_id: string;
  keyword_id: string;
  search_volume?: number;
  cpc?: number;
  competition?: number;
  updated_at: string;
}

export interface PropertyTotal {
  project_id: string;
  date: string; // YYYY-MM-DD
  country: string; // ISO-2 country code (e.g. IN, US)
  clicks: number;
  impressions: number;
  position: number;
}

export interface Annotation {
  id: string;
  project_id: string;
  date: string; // YYYY-MM-DD
  title: string;
  description?: string;
  keyword_id?: string; // Optional keyword link
  ranking_url?: string; // Optional URL link
  created_at: string;
}

export interface LocalStoreData {
  projects: Project[];
  keywords: Keyword[];
  rankings: Ranking[];
  integrations: Integration[];
  sync_logs: SyncLog[];
  sync_jobs: SyncJob[];
  rollups: KeywordRollup[];
  change_log: ChangeLog[];
  sync_skipped: SyncSkipped[];
  project_meta: ProjectMeta[];
  market: MarketData[];
  property_totals?: PropertyTotal[];
  annotations?: Annotation[];
}

