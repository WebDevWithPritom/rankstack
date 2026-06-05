import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const keywords = await store.getKeywords(projectId);
    const maxDateStr = store.getMaxRankingDate(projectId);

    let lastRankings: any[] = [];
    if (maxDateStr) {
      lastRankings = await store.getRankingsInRange(projectId, maxDateStr, maxDateStr);
    }
    const lastRankingsMap = new Map<string, any>();
    lastRankings.forEach(r => lastRankingsMap.set(r.keyword_id, r));

    const enrichedKeywords = keywords.map(k => {
      const rank = lastRankingsMap.get(k.id);
      return {
        ...k,
        is_updated_last_sync: !!rank,
        last_position: rank ? rank.position : null,
        last_clicks: rank ? rank.clicks : null,
        last_impressions: rank ? rank.impressions : null,
        last_updated: rank ? rank.date : maxDateStr
      };
    });

    // Sort by keyword text ascending
    enrichedKeywords.sort((a, b) => a.keyword.localeCompare(b.keyword));

    return NextResponse.json(enrichedKeywords);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, is_excluded, category, intent } = body;

    if (!id) {
      return NextResponse.json({ error: 'Keyword ID is required' }, { status: 400 });
    }

    // Read DB to find keyword
    const db = await store.readDb();
    const kwIndex = db.keywords.findIndex(k => k.id === id);

    if (kwIndex === -1) {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
    }

    const keywordObj = db.keywords[kwIndex];

    if (is_excluded !== undefined) {
      keywordObj.is_excluded = is_excluded;
    }
    if (category !== undefined) {
      keywordObj.category = category;
    }
    if (intent !== undefined) {
      keywordObj.intent = intent;
    }

    keywordObj.updated_at = new Date().toISOString();
    
    // Save updated keyword
    await store.updateKeyword(keywordObj);

    return NextResponse.json(keywordObj);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
