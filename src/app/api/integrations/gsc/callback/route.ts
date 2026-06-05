import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { handleAuthCallback } from '@/lib/gsc';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const projectId = searchParams.get('state'); // state contains the project ID

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!code || !projectId) {
    const errorUrl = new URL('/settings', baseUrl);
    errorUrl.searchParams.set('gsc_error', 'Missing code or project state');
    return NextResponse.redirect(errorUrl.toString());
  }

  try {
    await handleAuthCallback(projectId, code);
    
    const successUrl = new URL('/settings', baseUrl);
    successUrl.searchParams.set('projectId', projectId);
    successUrl.searchParams.set('gsc_success', 'true');
    return NextResponse.redirect(successUrl.toString());
  } catch (error: any) {
    console.error('OAuth callback handler failed:', error);
    const errorUrl = new URL('/settings', baseUrl);
    errorUrl.searchParams.set('projectId', projectId);
    errorUrl.searchParams.set('gsc_error', error.message || 'OAuth token exchange failed');
    return NextResponse.redirect(errorUrl.toString());
  }
}
