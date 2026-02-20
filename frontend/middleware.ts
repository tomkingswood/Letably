import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for Letably multi-tenant routing
 *
 * Handles:
 * 1. Agency slug extraction from URL path
 * 2. Agency validation (optional - can be moved to client)
 * 3. Protected route redirects
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip middleware for static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // Files with extensions
  ) {
    return NextResponse.next();
  }

  // Public routes that don't require agency context
  const publicRoutes = ['/signup', '/guarantor'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Extract agency slug from path (first segment)
  const segments = pathname.split('/').filter(Boolean);
  const agencySlug = segments[0];

  // If no agency slug in path, redirect to signup or show error
  if (!agencySlug) {
    // Root path - could show a landing page or redirect
    return NextResponse.next();
  }

  // Super admin routes - require HTTP Basic Auth as extra security layer
  if (agencySlug.toLowerCase() === 'sup3radm1n') {
    // Redirect to correct casing first
    if (agencySlug !== 'sup3rAdm1n') {
      const url = request.nextUrl.clone();
      url.pathname = pathname.replace(/^\/sup3radm1n/i, '/sup3rAdm1n');
      return NextResponse.redirect(url);
    }

    // SECURITY: Require explicit configuration - no fallback credentials
    const expectedUser = process.env.SUPER_ADMIN_BASIC_USER;
    const expectedPass = process.env.SUPER_ADMIN_BASIC_PASS;

    // If credentials not configured, deny access
    if (!expectedUser || !expectedPass) {
      console.error('SECURITY: Super admin credentials not configured. Set SUPER_ADMIN_BASIC_USER and SUPER_ADMIN_BASIC_PASS environment variables.');
      return new NextResponse('Super admin access not configured', {
        status: 503,
      });
    }

    // Check HTTP Basic Auth
    const authHeader = request.headers.get('authorization');

    if (authHeader) {
      const [scheme, encoded] = authHeader.split(' ');
      if (scheme === 'Basic' && encoded) {
        const decoded = atob(encoded);
        const [user, pass] = decoded.split(':');

        if (user === expectedUser && pass === expectedPass) {
          return NextResponse.next();
        }
      }
    }

    // Return 401 with WWW-Authenticate header to prompt for credentials
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Letably Platform Admin"',
      },
    });
  }

  // Reserved paths that are not agency slugs
  const reservedPaths = [
    'signup', 'guarantor', 'api', '_next', 'static',
    'applications', 'complaints',
    'cookie-policy', 'forgot-password', 'login',
    'redress-scheme', 'reset-password', 'setup-password',
    'terms-and-conditions', 'robots.txt', 'sitemap.xml',
  ];
  if (reservedPaths.includes(agencySlug)) {
    return NextResponse.next();
  }

  // Add agency slug to request headers for downstream use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-agency-slug', agencySlug);

  // Continue with the modified request
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

/**
 * Configure which paths the middleware runs on
 */
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next (Next.js internals)
     * - api (API routes)
     * - static files (js, css, images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
