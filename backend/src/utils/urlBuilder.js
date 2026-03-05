/**
 * URL Builder Utility
 *
 * Centralises frontend URL construction across the backend.
 * Supports custom domains: if an agency has a verified custom_portal_domain,
 * links use that domain (no slug prefix). Otherwise, uses the platform domain with slug.
 */

function getFrontendBaseUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:3000';
}

/**
 * Build a URL for an agency page.
 * If customDomain is provided, uses https://customDomain/path (no slug).
 * Otherwise, uses FRONTEND_URL/slug/path.
 */
function buildAgencyUrl(agencySlug, path, customDomain) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (customDomain) {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    // In development, append the frontend port so links work locally
    let port = '';
    if (process.env.NODE_ENV !== 'production' && !customDomain.includes(':')) {
      try {
        const frontendUrl = new URL(getFrontendBaseUrl());
        if (frontendUrl.port) port = `:${frontendUrl.port}`;
      } catch { /* ignore */ }
    }
    return `${protocol}://${customDomain}${port}${normalizedPath}`;
  }
  return `${getFrontendBaseUrl()}/${agencySlug}${normalizedPath}`;
}

function buildPublicUrl(path) {
  return `${getFrontendBaseUrl()}/${path}`;
}

module.exports = { getFrontendBaseUrl, buildAgencyUrl, buildPublicUrl };
