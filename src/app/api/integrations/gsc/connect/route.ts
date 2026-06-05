import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getAuthUrl } from '@/lib/gsc';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const authUrl = getAuthUrl(projectId);
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('Error generating Google OAuth URL:', error);
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
