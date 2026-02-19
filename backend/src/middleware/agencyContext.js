/**
 * Agency Context Middleware
 *
 * Sets the agency context for the request based on the URL slug or custom domain.
 * Must run before auth middleware.
 */

const db = require('../db');

/**
 * Lookup agency by slug
 */
async function getAgencyBySlug(slug) {
  const result = await db.systemQuery(
    `SELECT id, name, slug, email, phone, logo_url, primary_color, secondary_color,
            show_powered_by, subscription_tier, subscription_expires_at, is_active
     FROM agencies WHERE slug = $1`,
    [slug]
  );
  return result.rows[0] || null;
}

/**
 * Lookup agency by custom domain
 */
async function getAgencyByDomain(domain) {
  const result = await db.systemQuery(
    `SELECT id, name, slug, email, phone, logo_url, primary_color, secondary_color,
            show_powered_by, subscription_tier, subscription_expires_at, is_active,
            custom_portal_domain
     FROM agencies
     WHERE custom_portal_domain = $1 AND custom_domain_verified = true`,
    [domain]
  );
  return result.rows[0] || null;
}

/**
 * Agency context middleware
 *
 * Extracts agency from either:
 * - URL parameter (:agency_slug)
 * - Custom domain (Host header)
 * - JWT token (for authenticated requests)
 *
 * Sets req.agency and req.agencyId for downstream middleware
 */
const agencyContext = async (req, res, next) => {
  try {
    let agency = null;

    // Option 1: Agency slug in URL params
    if (req.params.agency_slug) {
      agency = await getAgencyBySlug(req.params.agency_slug);
    }

    // Option 2: Custom domain lookup
    if (!agency && req.headers.host) {
      const host = req.headers.host.split(':')[0]; // Remove port if present
      // Skip if it's the main domain
      if (!host.includes('letably.com') && !host.includes('localhost')) {
        agency = await getAgencyByDomain(host);
      }
    }

    // Option 3: Agency slug in X-Agency-Slug header (set by frontend API client)
    if (!agency && req.headers['x-agency-slug']) {
      agency = await getAgencyBySlug(req.headers['x-agency-slug']);
    }

    // Option 4: Agency slug in body or query (for login endpoints)
    if (!agency && (req.body?.agency_slug || req.query?.agency_slug)) {
      const slug = req.body?.agency_slug || req.query?.agency_slug;
      agency = await getAgencyBySlug(slug);
    }

    // If agency found, validate and set context
    if (agency) {
      if (!agency.is_active) {
        return res.status(403).json({
          error: 'Agency Inactive',
          message: 'This agency account is currently inactive. Please contact support.'
        });
      }

      req.agency = agency;
      req.agencyId = agency.id;
    }

    next();
  } catch (error) {
    console.error('Agency context error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to resolve agency context'
    });
  }
};

/**
 * Require agency context middleware
 *
 * Use after agencyContext to enforce that an agency is set
 */
const requireAgency = (req, res, next) => {
  if (!req.agency) {
    return res.status(400).json({
      error: 'Agency Required',
      message: 'This endpoint requires an agency context. Include agency_slug in the URL or request.'
    });
  }
  next();
};

module.exports = {
  agencyContext,
  requireAgency,
  getAgencyBySlug,
  getAgencyByDomain
};
