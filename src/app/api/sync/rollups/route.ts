import { NextRequest, NextResponse } from 'next/server';
import { computeProjectRollups } from '@/lib/rollups';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const result = await computeProjectRollups(projectId);

    return NextResponse.json({
      success: true,
      message: 'Rollups precomputation completed.',
      ...result
    });
  } catch (error: any) {
    console.error('API sync/rollups failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
