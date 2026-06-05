import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const user = process.env.HTTP_BASIC_AUTH_USER;
  const password = process.env.HTTP_BASIC_AUTH_PASSWORD;

  // Only enforce Basic Auth if environment variables are set
  if (user && password) {
    const basicAuth = req.headers.get('authorization');

    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1];
      try {
        const [u, p] = atob(authValue).split(':');
        if (u === user && p === password) {
          const response = NextResponse.next();
          response.headers.set('X-Robots-Tag', 'noindex, nofollow');
          return response;
        }
      } catch (e) {
        // Decode error
      }
    }

    return new NextResponse('Authentication Required.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  const response = NextResponse.next();
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
