import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/store';
import { Annotation } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const annotations = await store.getAnnotations(projectId);
    return NextResponse.json(annotations);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, id, date, title, description, keyword_id, ranking_url } = body;

    if (!projectId || !date || !title) {
      return NextResponse.json({ error: 'Project ID, Date, and Title are required' }, { status: 400 });
    }

    const annotation: Annotation = {
      id: id || `ann_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
      project_id: projectId,
      date,
      title,
      description: description || '',
      keyword_id: keyword_id || undefined,
      ranking_url: ranking_url || undefined,
      created_at: new Date().toISOString()
    };

    const saved = await store.saveAnnotation(annotation);
    return NextResponse.json(saved);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const id = searchParams.get('id');

    if (!projectId || !id) {
      return NextResponse.json({ error: 'Project ID and Annotation ID are required' }, { status: 400 });
    }

    await store.deleteAnnotation(projectId, id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
