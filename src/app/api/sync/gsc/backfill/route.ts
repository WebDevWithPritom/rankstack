import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import * as store from '@/lib/store';
import { syncGSCRankings } from '@/lib/gsc';
import { SyncJob } from '@/lib/types';

function getLast16Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  
  // Last 16 completed calendar months (oldest first)
  for (let i = 16; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
  }
  
  // Also include current partial month so recent data (24H, 7D) is populated
  const curY = now.getFullYear();
  const curM = String(now.getMonth() + 1).padStart(2, '0');
  months.push(`${curY}-${curM}`);
  
  return months;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const jobs = await store.getSyncJobs(projectId);
    // Find latest backfill job
    const job = jobs.length > 0 ? jobs[jobs.length - 1] : null;

    return NextResponse.json(job);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, action } = body;

    if (!projectId || !action) {
      return NextResponse.json({ error: 'Project ID and Action are required' }, { status: 400 });
    }

    const jobs = await store.getSyncJobs(projectId);
    let job = jobs.length > 0 ? jobs[jobs.length - 1] : null;

    if (action === 'start') {
      // If there is an active job, return it
      if (job && (job.status === 'running' || job.status === 'idle')) {
        return NextResponse.json(job);
      }

      const months = getLast16Months();
      const newJob: SyncJob = {
        id: `job_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
        project_id: projectId,
        status: 'running',
        months_done: 0,
        total_months: months.length,
        next_month: months[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      job = await store.saveSyncJob(newJob);
      return NextResponse.json(job);
    }

    if (action === 'step') {
      if (!job || job.status !== 'running') {
        return NextResponse.json({ error: 'No active running backfill job found' }, { status: 400 });
      }

      const currentMonthStr = job.next_month; // YYYY-MM
      const parts = currentMonthStr.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);

      // Start of month
      const startDate = `${currentMonthStr}-01`;

      // End date: for current month, cap at yesterday-2days (GSC 2-day lag); for past months use last day of month
      const now = new Date();
      const isCurrentMonth = (year === now.getFullYear() && month === now.getMonth() + 1);
      let endDate: string;
      if (isCurrentMonth) {
        // GSC data is lagged by 2 days, so fetch up to 2 days ago
        const gscEnd = new Date(now);
        gscEnd.setDate(gscEnd.getDate() - 2);
        endDate = gscEnd.toISOString().split('T')[0];
      } else {
        // Last day of past month
        const lastDay = new Date(year, month, 0).getDate();
        endDate = `${currentMonthStr}-${String(lastDay).padStart(2, '0')}`;
      }

      try {
        console.log(`Backfill step running: ${startDate} to ${endDate}`);
        // Perform sync for this month
        await syncGSCRankings(projectId, startDate, endDate, 'backfill');

        // Increment progress
        job.months_done += 1;
        job.updated_at = new Date().toISOString();

        // Calculate next month
        const monthsList = getLast16Months();
        const currentIndex = monthsList.indexOf(currentMonthStr);
        
        if (job.months_done >= job.total_months || currentIndex === -1 || currentIndex === monthsList.length - 1) {
          job.status = 'completed';
          job.next_month = '';
        } else {
          job.next_month = monthsList[currentIndex + 1];
        }

        job = await store.saveSyncJob(job);
        return NextResponse.json(job);
      } catch (error: any) {
        console.error('Backfill step failed:', error);
        job.status = 'failed';
        job.updated_at = new Date().toISOString();
        job = await store.saveSyncJob(job);
        return NextResponse.json({
          error: error.message || 'Sync failed',
          job
        }, { status: 500 });
      }
    }

    if (action === 'cancel') {
      if (job) {
        job.status = 'failed';
        job.updated_at = new Date().toISOString();
        job = await store.saveSyncJob(job);
        return NextResponse.json(job);
      }
      return NextResponse.json({ error: 'No job found to cancel' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
