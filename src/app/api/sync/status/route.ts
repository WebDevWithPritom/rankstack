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

    const logs = await store.getSyncLogs(projectId);
    // Sort logs descending by date/time
    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latestLog = logs.length > 0 ? logs[0] : null;

    const jobs = await store.getSyncJobs(projectId);
    const latestJob = jobs.length > 0 ? jobs[jobs.length - 1] : null;

    return NextResponse.json({
      latestLog,
      latestJob,
      history: logs.slice(0, 10) // Return last 10 logs for sync audit view
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
