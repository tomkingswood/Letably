/**
 * Agency Model
 *
 * Database operations for agencies.
 * Note: Agencies are not subject to RLS as they are the tenant entity.
 */

const db = require('../db');

/**
 * Find agency by ID
 */
async function findById(id) {
  const result = await db.systemQuery(
    `SELECT id, name, slug, email, phone, logo_url, primary_color, secondary_color,
            show_powered_by, custom_portal_domain, custom_domain_verified,
            subscription_tier, subscription_expires_at, is_active, public_api_key,
            api_rate_limit, property_images_enabled, created_at, updated_at
     FROM agencies WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Find agency by slug
 */
async function findBySlug(slug) {
  const result = await db.systemQuery(
    `SELECT id, name, slug, email, phone, logo_url, primary_color, secondary_color,
            show_powered_by, custom_portal_domain, custom_domain_verified,
            subscription_tier, subscription_expires_at, is_active, public_api_key,
            api_rate_limit, property_images_enabled, created_at, updated_at
     FROM agencies WHERE slug = $1`,
    [slug]
  );
  return result.rows[0] || null;
}

/**
 * Find agency by custom domain
 */
async function findByDomain(domain) {
  const result = await db.systemQuery(
    `SELECT id, name, slug, email, phone, logo_url, primary_color, secondary_color,
            show_powered_by, custom_portal_domain, custom_domain_verified,
            subscription_tier, subscription_expires_at, is_active
     FROM agencies
     WHERE custom_portal_domain = $1 AND custom_domain_verified = true`,
    [domain]
  );
  return result.rows[0] || null;
}

/**
 * Find agency by API key
 */
async function findByApiKey(apiKey) {
  const result = await db.systemQuery(
    `SELECT id, name, slug, email, is_active, api_rate_limit
     FROM agencies WHERE public_api_key = $1`,
    [apiKey]
  );
  return result.rows[0] || null;
}

/**
 * Create new agency
 */
async function create(data) {
  const {
    name,
    slug,
    email,
    phone,
    logo_url,
    primary_color = '#1E3A5F',
    secondary_color,
    subscription_tier = 'standard'
  } = data;

  const result = await db.systemQuery(
    `INSERT INTO agencies (name, slug, email, phone, logo_url, primary_color, secondary_color, subscription_tier)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [name, slug, email, phone, logo_url, primary_color, secondary_color, subscription_tier]
  );
  return result.rows[0];
}

/**
 * Update agency
 */
async function update(id, data) {
  const allowedFields = [
    'name', 'email', 'phone', 'logo_url', 'primary_color', 'secondary_color',
    'show_powered_by', 'custom_portal_domain', 'custom_domain_verified',
    'subscription_tier', 'subscription_expires_at', 'is_active', 'api_rate_limit',
    'property_images_enabled'
  ];

  const updates = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  }

  if (updates.length === 0) {
    return findById(id);
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);

  const result = await db.systemQuery(
    `UPDATE agencies SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0];
}

/**
 * Update agency branding
 */
async function updateBranding(id, data) {
  const { logo_url, primary_color, secondary_color, show_powered_by } = data;

  const result = await db.systemQuery(
    `UPDATE agencies
     SET logo_url = COALESCE($1, logo_url),
         primary_color = COALESCE($2, primary_color),
         secondary_color = COALESCE($3, secondary_color),
         show_powered_by = COALESCE($4, show_powered_by),
         updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [logo_url, primary_color, secondary_color, show_powered_by, id]
  );
  return result.rows[0];
}

/**
 * Generate and set public API key
 */
async function generateApiKey(id) {
  const crypto = require('crypto');
  const apiKey = `letably_${crypto.randomBytes(24).toString('hex')}`;

  const result = await db.systemQuery(
    `UPDATE agencies SET public_api_key = $1, updated_at = NOW() WHERE id = $2 RETURNING public_api_key`,
    [apiKey, id]
  );
  return result.rows[0]?.public_api_key;
}

/**
 * Revoke API key
 */
async function revokeApiKey(id) {
  await db.systemQuery(
    `UPDATE agencies SET public_api_key = NULL, updated_at = NOW() WHERE id = $1`,
    [id]
  );
}

/**
 * Check if slug is available
 */
async function isSlugAvailable(slug, excludeId = null) {
  const query = excludeId
    ? `SELECT COUNT(*) as count FROM agencies WHERE slug = $1 AND id != $2`
    : `SELECT COUNT(*) as count FROM agencies WHERE slug = $1`;

  const params = excludeId ? [slug, excludeId] : [slug];
  const result = await db.systemQuery(query, params);

  return result.rows[0].count === '0';
}

/**
 * Get all agencies (admin use)
 */
async function getAll(options = {}) {
  const { is_active, subscription_tier, limit = 100, offset = 0 } = options;

  let query = `SELECT * FROM agencies WHERE 1=1`;
  const params = [];
  let paramIndex = 1;

  if (is_active !== undefined) {
    query += ` AND is_active = $${paramIndex++}`;
    params.push(is_active);
  }

  if (subscription_tier) {
    query += ` AND subscription_tier = $${paramIndex++}`;
    params.push(subscription_tier);
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);

  const result = await db.systemQuery(query, params);
  return result.rows;
}

module.exports = {
  findById,
  findBySlug,
  findByDomain,
  findByApiKey,
  create,
  update,
  updateBranding,
  generateApiKey,
  revokeApiKey,
  isSlugAvailable,
  getAll
};
