import { Ranking, Keyword, Integration, SyncSkipped, SyncLog } from './types';
import * as store from './store';
import { decrypt, encrypt } from './crypto';
import { mergeGSCRankings } from './gsc-ranking-merge';
import { computeProjectRollups } from './rollups';

// Map GSC 3-letter codes to ISO-2 codes
const COUNTRY_3_TO_2: Record<string, string> = {
  afg: 'AF', ala: 'AX', alb: 'AL', dza: 'DZ', asm: 'AS', and: 'AD', ago: 'AO', aia: 'AI', ata: 'AQ', atg: 'AG',
  arg: 'AR', arm: 'AM', abw: 'AW', aus: 'AU', aut: 'AT', aze: 'AZ', bhs: 'BS', bhr: 'BH', bgd: 'BD', brb: 'BB',
  blr: 'BY', bel: 'BE', blz: 'BZ', ben: 'BJ', bmu: 'BM', btn: 'BT', bol: 'BO', bes: 'BQ', bih: 'BA', bwa: 'BW',
  bvt: 'BV', bra: 'BR', iot: 'IO', brn: 'BN', bgr: 'BG', bfa: 'BF', bdi: 'BI', cpv: 'CV', khm: 'KH', cmr: 'CM',
  can: 'CA', cym: 'KY', caf: 'CF', tcd: 'TD', chl: 'CL', chn: 'CN', cxr: 'CX', cck: 'CC', col: 'CO', com: 'KM',
  cog: 'CG', cod: 'CD', cok: 'CK', cri: 'CR', civ: 'CI', hrv: 'HR', cub: 'CU', cuw: 'CW', cyp: 'CY', cze: 'CZ',
  dnk: 'DK', dji: 'DJ', dma: 'DM', dom: 'DO', ecu: 'EC', egy: 'EG', slv: 'SV', gnq: 'GQ', eri: 'ER', est: 'EE',
  eth: 'ET', flk: 'FK', fro: 'FO', fji: 'FJ', fin: 'FI', fra: 'FR', guf: 'GF', pyf: 'PF', atf: 'TF', gab: 'GA',
  gmb: 'GM', geo: 'GE', deu: 'DE', gha: 'GH', gib: 'GI', grc: 'GR', grl: 'GL', grd: 'GD', glp: 'GP', gum: 'GU',
  gtm: 'GT', ggy: 'GG', gin: 'GN', gnb: 'GW', guy: 'GY', hti: 'HT', hmd: 'HM', vat: 'VA', hnd: 'HN', hkg: 'HK',
  hun: 'HU', isl: 'IS', ind: 'IN', idn: 'ID', irn: 'IR', irq: 'IQ', irl: 'IE', imn: 'IM', isr: 'IL', ita: 'IT',
  jam: 'JM', jpn: 'JP', jey: 'JE', jor: 'JO', kaz: 'KZ', ken: 'KE', kir: 'KI', prk: 'KP', kor: 'KR', kwt: 'KW',
  kgz: 'KG', lao: 'LA', lva: 'LV', lbn: 'LB', lso: 'LS', lbr: 'LR', lby: 'LY', lie: 'LI', ltu: 'LT', lux: 'LU',
  mac: 'MO', mkd: 'MK', mdg: 'MG', mwi: 'MW', mys: 'MY', mdv: 'MV', mli: 'ML', mlt: 'MT', mhl: 'MH', mtq: 'MQ',
  mrt: 'MR', mus: 'MU', myt: 'YT', mex: 'MX', fsm: 'FM', mda: 'MD', mco: 'MC', mng: 'MN', mne: 'ME', msr: 'MS',
  mar: 'MA', moz: 'MZ', mmr: 'MM', nam: 'NA', nru: 'NR', npl: 'NP', nld: 'NL', ncl: 'NC', nzl: 'NZ', nic: 'NI',
  ner: 'NE', nga: 'NG', niu: 'NU', nfk: 'NF', mnp: 'MP', nor: 'NO', omn: 'OM', pak: 'PK', plw: 'PW', pse: 'PS',
  pan: 'PA', png: 'PG', pry: 'PY', per: 'PE', phl: 'PH', pcn: 'PN', pol: 'PL', prt: 'PT', pri: 'PR', qat: 'QA',
  reu: 'RE', rou: 'RO', rus: 'RU', rwa: 'RW', blm: 'BL', shn: 'SH', kna: 'KN', lca: 'LC', maf: 'MF', spm: 'PM',
  vct: 'VC', wsm: 'WS', smr: 'SM', stp: 'ST', sau: 'SA', sen: 'SN', srb: 'RS', syc: 'SC', sle: 'SL', sgp: 'SG',
  sxm: 'SX', svk: 'SK', svn: 'SI', slb: 'SB', som: 'SO', zaf: 'ZA', sgs: 'GS', ssd: 'SS', esp: 'ES', lka: 'LK',
  sdn: 'SD', sur: 'SR', sjm: 'SJ', swz: 'SZ', swe: 'SE', che: 'CH', syr: 'SY', twn: 'TW', tjk: 'TJ', tza: 'TZ',
  tha: 'TH', tls: 'TL', tgo: 'TG', tkl: 'TK', ton: 'TO', tto: 'TT', tun: 'TN', tur: 'TR', tkm: 'TM', tca: 'TC',
  tuv: 'TV', uga: 'UG', ukr: 'UA', are: 'AE', gbr: 'GB', usa: 'US', umi: 'UM', ury: 'UY', uzb: 'UZ', vut: 'VU',
  ven: 'VE', vnm: 'VN', vgb: 'VG', vir: 'VI', wlf: 'WF', esh: 'EH', yem: 'YE', zmb: 'ZM', zwe: 'ZW'
};

export function normalizeCountryCode(code: string): string {
  if (!code) return 'US';
  const clean = code.toLowerCase().trim();
  return COUNTRY_3_TO_2[clean] || clean.toUpperCase();
}

export function getAuthUrl(projectId: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error('GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI is not set in environment variables');
  }

  const scopes = ['https://www.googleapis.com/auth/webmasters.readonly'];
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: projectId
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function handleAuthCallback(projectId: string, code: string): Promise<void> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth credentials not configured');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to exchange auth code: ${errText}`);
  }

  const tokens = await response.json();
  const metadata = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || '', // refresh token is only sent on first consent
    expiry_date: Date.now() + tokens.expires_in * 1000
  };

  const integration = await store.getIntegration(projectId, 'gsc');
  const prevMetadata = integration?.metadata ? JSON.parse(decrypt(integration.metadata)) : {};

  // Preserve refresh token if Google didn't send a new one
  if (!metadata.refresh_token && prevMetadata.refresh_token) {
    metadata.refresh_token = prevMetadata.refresh_token;
  }

  await store.saveIntegration({
    project_id: projectId,
    type: 'gsc',
    is_active: true,
    metadata: encrypt(JSON.stringify(metadata))
  });
}

export async function refreshGSCToken(projectId: string, refresh_token: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth client credentials not set');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh GSC token: ${await response.text()}`);
  }

  const tokens = await response.json();
  const metadata = {
    access_token: tokens.access_token,
    refresh_token: refresh_token, // keep the same
    expiry_date: Date.now() + tokens.expires_in * 1000
  };

  await store.saveIntegration({
    project_id: projectId,
    type: 'gsc',
    is_active: true,
    metadata: encrypt(JSON.stringify(metadata))
  });

  return tokens.access_token;
}

export async function getGSCAccessToken(projectId: string): Promise<string> {
  const integration = await store.getIntegration(projectId, 'gsc');
  if (!integration || !integration.is_active || !integration.metadata) {
    throw new Error('GSC integration not configured or inactive for this project');
  }

  const tokens = JSON.parse(decrypt(integration.metadata));
  if (!tokens.access_token) {
    throw new Error('Missing GSC access token');
  }

  // Refresh token if expired or close to expiring (within 2 minutes)
  if (tokens.expiry_date && Date.now() > tokens.expiry_date - 120000) {
    if (!tokens.refresh_token) {
      throw new Error('Access token expired and no refresh token available. Reconnect GSC.');
    }
    return refreshGSCToken(projectId, tokens.refresh_token);
  }

  return tokens.access_token;
}

interface GSCAPIResponseRow {
  keys: string[]; // query, date, country, page
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

async function fetchGSCWithRetry(url: string, options: RequestInit, retries = 3, delay = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      
      // If rate limit (429) or server errors (5xx), wait and retry
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        console.warn(`GSC API returned ${response.status}. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // exponential backoff
        continue;
      }
      
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      console.warn(`Fetch error: ${error}. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  throw new Error(`Failed to fetch after ${retries} retries`);
}

async function querySearchConsole(
  siteUrl: string,
  accessToken: string,
  startDate: string,
  endDate: string,
  startRow = 0,
  rowLimit = 5000
): Promise<GSCAPIResponseRow[]> {
  // Normalize siteUrl format for GSC API (must match property)
  const encodedSite = encodeURIComponent(siteUrl);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`;

  const response = await fetchGSCWithRetry(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ['query', 'date', 'country', 'page'],
      rowLimit,
      startRow
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google API request failed: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.rows || [];
}

interface GSCPropertyTotalRow {
  keys: string[]; // date, country
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

async function querySearchConsolePropertyTotals(
  siteUrl: string,
  accessToken: string,
  startDate: string,
  endDate: string,
  startRow = 0,
  rowLimit = 5000
): Promise<GSCPropertyTotalRow[]> {
  const encodedSite = encodeURIComponent(siteUrl);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`;

  const response = await fetchGSCWithRetry(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ['date', 'country'],
      rowLimit,
      startRow
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google API request failed (Property Totals): ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.rows || [];
}

/**
 * Fetches GSC query data for a date range, auto-paginating up to 25k.
 * If 25k cap is hit, fetches day-by-day.
 */
export async function syncGSCRankings(
  projectId: string,
  startDate: string,
  endDate: string,
  syncType: SyncLog['type']
): Promise<void> {
  const project = await store.getProject(projectId);
  if (!project) throw new Error('Project not found');

  const logId = `log_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  const nowStr = new Date().toISOString();

  // Create running sync log
  const syncLog: SyncLog = {
    id: logId,
    project_id: projectId,
    date: new Date().toISOString().split('T')[0],
    status: 'running',
    message: `Starting sync (${syncType}) for range ${startDate} to ${endDate}`,
    type: syncType,
    created_at: nowStr
  };
  await store.addSyncLog(syncLog);

  try {
    const accessToken = await getGSCAccessToken(projectId);
    let allRows: GSCAPIResponseRow[] = [];
    let isCapHit = false;

    // Fetch range data up to 25k (5 pages)
    for (let page = 0; page < 5; page++) {
      const startRow = page * 5000;
      const rows = await querySearchConsole(project.domain, accessToken, startDate, endDate, startRow, 5000);
      allRows.push(...rows);
      if (rows.length < 5000) {
        break;
      }
      if (page === 4 && rows.length === 5000) {
        isCapHit = true;
      }
    }

    // If we hit the 25k cap, fetch one day at a time
    if (isCapHit) {
      console.log(`Cap of 25k hit for range ${startDate} to ${endDate}. Splitting sync day-by-day.`);
      allRows = []; // Clear combined rows

      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysList: string[] = [];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        daysList.push(d.toISOString().split('T')[0]);
      }

      for (const day of daysList) {
        console.log(`Syncing single day: ${day}`);
        for (let page = 0; page < 5; page++) {
          const startRow = page * 5000;
          const rows = await querySearchConsole(project.domain, accessToken, day, day, startRow, 5000);
          allRows.push(...rows);
          if (rows.length < 5000) break;
        }
      }
    }

    // Process and save results
    await processAndStoreGSCRows(projectId, allRows, startDate, endDate);

    // Fetch and save daily property totals by country (without query dimensions, so no privacy filtering)
    console.log(`Syncing property-level totals for range ${startDate} to ${endDate}...`);
    const allPropertyRows: GSCPropertyTotalRow[] = [];
    let propStartRow = 0;
    const propLimit = 5000;
    while (true) {
      const rows = await querySearchConsolePropertyTotals(project.domain, accessToken, startDate, endDate, propStartRow, propLimit);
      allPropertyRows.push(...rows);
      if (rows.length < propLimit) break;
      propStartRow += propLimit;
    }

    const propertyTotals = allPropertyRows.map(r => {
      const date = r.keys[0];
      const country = normalizeCountryCode(r.keys[1]);
      return {
        project_id: projectId,
        date,
        country,
        clicks: r.clicks,
        impressions: r.impressions,
        position: r.position
      };
    });

    await store.savePropertyTotals(projectId, propertyTotals);
    console.log(`Successfully synced ${propertyTotals.length} property total rows.`);

    // Update log to success
    syncLog.status = 'success';
    syncLog.message = `Successfully synced ${allRows.length} rows for range ${startDate} to ${endDate}.`;
    await store.addSyncLog(syncLog);

  } catch (error: any) {
    console.error('GSC sync failed:', error);
    syncLog.status = 'failed';
    syncLog.message = `Sync failed: ${error.message || error}`;
    syncLog.details = error.stack || '';
    await store.addSyncLog(syncLog);
    throw error;
  }
}

/**
 * Normalizes, deduplicates, and stores raw GSC rows in local DB.
 */
async function processAndStoreGSCRows(
  projectId: string,
  rows: GSCAPIResponseRow[],
  startDate: string,
  endDate: string
): Promise<void> {
  if (rows.length === 0) return;

  const skippedRows: any[] = [];
  const keywordPairsToEnsure: Array<{ keyword: string; country: string }> = [];

  // Fetch custom skip rules
  const metas = await store.getProjectMeta(projectId);
  const skipMeta = metas.find(m => m.key === 'skip_keywords');
  const skipKeywords: string[] = skipMeta ? JSON.parse(skipMeta.value) : [];
  const skipKeywordsLower = skipKeywords.map(k => k.toLowerCase());

  // Filter and normalize rows
  const validRows = rows.filter(r => {
    // GSC query dimension can sometimes be empty, and country must exist
    const query = r.keys[0];
    const country = r.keys[2];
    
    if (!query) {
      skippedRows.push({
        id: `skip_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
        project_id: projectId,
        date: r.keys[1] || startDate,
        keyword: '[empty]',
        country: normalizeCountryCode(country),
        reason: 'Empty query dimension',
        clicks: r.clicks,
        impressions: r.impressions
      });
      return false;
    }
    
    if (!country) {
      skippedRows.push({
        id: `skip_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
        project_id: projectId,
        date: r.keys[1] || startDate,
        keyword: query,
        country: 'UNKNOWN',
        reason: 'Missing country dimension',
        clicks: r.clicks,
        impressions: r.impressions
      });
      return false;
    }

    // Custom Skip Keywords Check
    const queryLower = query.toLowerCase();
    const isCustomSkipped = skipKeywordsLower.some(pattern => 
      queryLower === pattern || queryLower.includes(pattern)
    );

    if (isCustomSkipped) {
      skippedRows.push({
        id: `skip_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
        project_id: projectId,
        date: r.keys[1] || startDate,
        keyword: query,
        country: normalizeCountryCode(country),
        reason: 'Excluded by Skip Rules',
        clicks: r.clicks,
        impressions: r.impressions
      });
      return false;
    }

    keywordPairsToEnsure.push({
      keyword: query,
      country: normalizeCountryCode(country)
    });
    return true;
  });

  // Bulk ensure keywords are saved and mapped to IDs
  const allKeywords = await store.ensureKeywords(projectId, keywordPairsToEnsure);
  
  // Create a quick lookup map for keyword IDs
  const keywordIdMap = new Map<string, string>();
  for (const kw of allKeywords) {
    keywordIdMap.set(`${kw.keyword.toLowerCase()}||${kw.country.toUpperCase()}`, kw.id);
  }

  // Format into Raw Rankings for merging
  const rawRankingsInput = validRows.map(r => {
    const query = r.keys[0];
    const date = r.keys[1];
    const country = normalizeCountryCode(r.keys[2]);
    const pageUrl = r.keys[3] || '';

    const kwId = keywordIdMap.get(`${query.toLowerCase()}||${country.toUpperCase()}`) || '';

    return {
      keyword_id: kwId,
      date,
      position: r.position,
      clicks: r.clicks,
      impressions: r.impressions,
      ranking_url: pageUrl
    };
  }).filter(r => r.keyword_id !== ''); // safeguard

  // Run GSC merge logic
  const mergedRankings = mergeGSCRankings(rawRankingsInput);

  // Save the rankings
  await store.saveRankings(projectId, mergedRankings);

  // Re-compute project rollups
  await computeProjectRollups(projectId);

  // Log skipped rows if any
  if (skippedRows.length > 0) {
    await store.addSyncSkipped(skippedRows);
  }
}
