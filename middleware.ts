import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'kmp_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Full session validity (expiry, DB lookup) is checked again in each
    // server component / route handler via getSessionUser(), since
    // middleware (edge runtime) should stay lightweight and avoid a DB
    // round-trip on every request.
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
