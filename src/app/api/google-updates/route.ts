import { NextResponse } from 'next/server';
import { GOOGLE_UPDATES } from '@/lib/google-updates-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Return sorted descending by start date
  const sorted = [...GOOGLE_UPDATES].sort((a, b) => b.startDate.localeCompare(a.startDate));
  return NextResponse.json(sorted);
}
