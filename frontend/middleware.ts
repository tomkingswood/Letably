import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In-memory cache for domain → slug resolution (persists across requests in the same edge worker)
const domainCache = new Map<string, { slug: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_ENTRIES = 1000;

/**
 * Known platform hostnames that are NOT custom domains
 */
function isPlatformHost(host: string): boolean {
  const h = host.split(':')[0].toLowerCase();
  return (
    h === 'localhost' || h === '127.0.0.1' ||
    h === 'letably.com' || h.endsWith('.letably.com') ||
    h === 'vercel.app' || h.endsWith('.vercel.app')
  );
}

/**
 * Resolve custom domain to agency slug via backend API
 */
async function resolveCustomDomain(domain: string): Promise<string | null> {
  // Check cache first, delete if expired
  const cached = domainCache.get(domain);
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      return cached.slug || null;
    }
    domainCache.delete(domain);
  }

  // Prune expired entries and enforce max size
  if (domainCache.size > CACHE_MAX_ENTRIES) {
    const now = Date.now();
    for (const [key, entry] of domainCache) {
      if (entry.expiresAt <= now || domainCache.size > CACHE_MAX_ENTRIES) {
        domainCache.delete(key);
      }
    }
  }

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const res = await fetch(`${apiUrl}/agencies/resolve-domain?domain=${encodeURIComponent(domain)}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      // Cache miss for 1 minute to avoid hammering on unknown domains
      domainCache.set(domain, { slug: '', expiresAt: Date.now() + 60_000 });
      return null;
    }

    const data = await res.json();
    if (data.slug) {
      domainCache.set(domain, { slug: data.slug, expiresAt: Date.now() + CACHE_TTL_MS });
      return data.slug;
    }
  } catch (err) {
    console.error('Failed to resolve custom domain:', domain, err);
  }

  return null;
}

/**
 * Middleware for Letably multi-tenant routing
 *
 * Handles:
 * 1. Custom domain → slug resolution + URL rewrite
 * 2. Agency slug extraction from URL path
 * 3. Protected route redirects
 */
export async function middleware(request: NextRequest) {
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
  const publicRoutes = ['/signup'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // --- Custom domain detection ---
  const host = request.headers.get('host')?.split(':')[0] || '';

  if (!isPlatformHost(host)) {
    // Custom domain: resolve to agency slug
    const slug = await resolveCustomDomain(host);

    if (!slug) {
      // Unknown custom domain — show error
      return new NextResponse('Agency not found for this domain', { status: 404 });
    }

    // Rewrite: portal.steelcityliving.com/tenancy → /steel-city-living/tenancy (internally)
    // The browser URL stays as portal.steelcityliving.com/tenancy
    const url = request.nextUrl.clone();
    url.pathname = `/${slug}${pathname}`;

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-agency-slug', slug);
    requestHeaders.set('x-custom-domain', 'true');

    return NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
  }

  // --- Standard slug-based routing (letably.com/steel-city-living/...) ---

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
    'signup', 'api', '_next', 'static',
    'complaints',
    'cookie-policy', 'forgot-password', 'login',
    'redress-scheme', 'reset-password',
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
