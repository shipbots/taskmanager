import { auth } from '@/auth';

// Next.js 16 renamed "middleware" to "proxy" (same runtime contract).
// Protect every page route; unauthenticated visitors are sent to /login.
// API routes guard themselves (returning 401 JSON) and are excluded here.
export default auth((req) => {
  if (!req.auth) {
    const url = new URL('/login', req.nextUrl.origin);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ['/((?!api|login|_next/static|_next/image|favicon.ico).*)'],
};
