import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import * as store from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const skipped = await store.getSyncSkipped(projectId);
    // Sort by date descending
    skipped.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json(skipped);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
