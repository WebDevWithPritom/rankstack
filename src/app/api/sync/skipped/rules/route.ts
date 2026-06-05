import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }
    const metas = await store.getProjectMeta(projectId);
    const skipMeta = metas.find(m => m.key === 'skip_keywords');
    const skipKeywords = skipMeta ? JSON.parse(skipMeta.value) : [];
    return NextResponse.json({ skipKeywords });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, skipKeywords } = body;
    if (!projectId || !Array.isArray(skipKeywords)) {
      return NextResponse.json({ error: 'Project ID and skipKeywords array are required' }, { status: 400 });
    }
    
    // Normalize: trim, remove empty, lowercase for uniform matching
    const normalized = Array.from(new Set(
      skipKeywords
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0)
    ));

    await store.setProjectMeta(projectId, 'skip_keywords', JSON.stringify(normalized));
    return NextResponse.json({ success: true, skipKeywords: normalized });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
