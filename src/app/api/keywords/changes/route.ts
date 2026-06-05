import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const changeLogs = await store.getChangeLogs(projectId);
    const keywords = await store.getKeywords(projectId);

    // Map keywords for quick lookup
    const kwMap = new Map<string, { term: string; country: string }>();
    keywords.forEach(k => {
      kwMap.set(k.id, { term: k.keyword, country: k.country });
    });

    // Populate keyword details in change logs
    const detailedLogs = changeLogs.map(log => {
      const kw = kwMap.get(log.keyword_id);
      return {
        ...log,
        keyword: kw ? kw.term : 'Deleted Keyword',
        country: kw ? kw.country : '??'
      };
    });

    // Sort by date/timestamp descending
    detailedLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json(detailedLogs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
