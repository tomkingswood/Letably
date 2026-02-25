/**
 * Agency Service
 *
 * Business logic for agency operations.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const AgencyModel = require('../models/agency');
const AgencySettingsModel = require('../models/agencySettings');
const db = require('../db');

/**
 * Generate URL-safe slug from name
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * Ensure slug is unique
 */
async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug;
  let counter = 1;

  while (!(await AgencyModel.isSlugAvailable(slug, excludeId))) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Register new agency with admin user
 */
async function registerAgency(data) {
  const {
    agency_name,
    agency_email,
    agency_phone,
    admin_email,
    admin_password,
    admin_first_name,
    admin_last_name,
    admin_phone
  } = data;

  // Generate unique slug
  const baseSlug = generateSlug(agency_name);
  const slug = await ensureUniqueSlug(baseSlug);

  // Start transaction
  return db.transaction(async (client) => {
    // Create agency
    const agencyResult = await client.query(
      `INSERT INTO agencies (name, slug, email, phone, primary_color)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [agency_name, slug, agency_email, agency_phone, '#1E3A5F']
    );
    const agency = agencyResult.rows[0];

    // Create default site settings for the agency
    const defaultSettings = [
      ['payment_reminder_days_before', '7'],
      ['overdue_reminder_frequency', '3'],
      ['certificate_reminder_days', '30'],
      ['public_site_enabled', 'true']
    ];

    for (const [key, value] of defaultSettings) {
      await client.query(
        `INSERT INTO site_settings (agency_id, setting_key, setting_value)
         VALUES ($1, $2, $3)
         ON CONFLICT (agency_id, setting_key) DO NOTHING`,
        [agency.id, key, value]
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(admin_password, 10);

    // Create admin user
    const userResult = await client.query(
      `INSERT INTO users (agency_id, email, password_hash, first_name, last_name, phone, role, is_active, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, 'admin', true, true)
       RETURNING id, email, first_name, last_name, role`,
      [agency.id, admin_email.toLowerCase(), passwordHash, admin_first_name, admin_last_name, admin_phone]
    );
    const admin = userResult.rows[0];

    return {
      agency,
      admin
    };
  });
}

/**
 * Get agency public info (for login page, etc.)
 */
async function getPublicInfo(slug) {
  const agency = await AgencyModel.findBySlug(slug);

  if (!agency) {
    return null;
  }

  // Return only public fields
  return {
    id: agency.id,
    name: agency.name,
    slug: agency.slug,
    logo_url: agency.logo_url,
    primary_color: agency.primary_color,
    secondary_color: agency.secondary_color,
    show_powered_by: agency.show_powered_by,
    is_active: agency.is_active,
    property_images_enabled: agency.property_images_enabled
  };
}

/**
 * Get full agency info (for authenticated admins)
 */
async function getFullInfo(agencyId) {
  const agency = await AgencyModel.findById(agencyId);
  const settings = await AgencySettingsModel.get(agencyId);

  return {
    agency,
    settings
  };
}

/**
 * Update agency branding
 */
async function updateBranding(agencyId, data) {
  // Validate hex color format
  const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

  if (data.primary_color && !hexColorRegex.test(data.primary_color)) {
    throw new Error('Invalid primary color format. Use hex format: #RRGGBB');
  }

  if (data.secondary_color && !hexColorRegex.test(data.secondary_color)) {
    throw new Error('Invalid secondary color format. Use hex format: #RRGGBB');
  }

  return AgencyModel.updateBranding(agencyId, data);
}

/**
 * Update agency settings
 */
async function updateSettings(agencyId, data) {
  return AgencySettingsModel.update(agencyId, data);
}

/**
 * Set up custom domain
 */
async function setupCustomDomain(agencyId, domain) {
  // Validate domain format
  const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
  if (!domainRegex.test(domain)) {
    throw new Error('Invalid domain format');
  }

  // Check if domain is already in use
  const existing = await AgencyModel.findByDomain(domain);
  if (existing && existing.id !== agencyId) {
    throw new Error('Domain is already in use by another agency');
  }

  // Generate verification token
  const verificationToken = crypto.randomBytes(16).toString('hex');

  await AgencyModel.update(agencyId, {
    custom_portal_domain: domain,
    custom_domain_verified: false
  });

  // Return verification instructions
  return {
    domain,
    verification_token: verificationToken,
    dns_record: {
      type: 'TXT',
      name: `_letably-verification.${domain}`,
      value: `letably-verify=${verificationToken}`
    }
  };
}

/**
 * Verify custom domain DNS
 */
async function verifyCustomDomain(agencyId) {
  const agency = await AgencyModel.findById(agencyId);

  if (!agency.custom_portal_domain) {
    throw new Error('No custom domain configured');
  }

  // In production, this would check DNS records
  // For now, just mark as verified
  await AgencyModel.update(agencyId, {
    custom_domain_verified: true
  });

  return { verified: true };
}

/**
 * Generate or regenerate API key
 */
async function generateApiKey(agencyId) {
  return AgencyModel.generateApiKey(agencyId);
}

/**
 * Revoke API key
 */
async function revokeApiKey(agencyId) {
  return AgencyModel.revokeApiKey(agencyId);
}

/**
 * Check subscription status
 */
async function checkSubscription(agencyId) {
  const agency = await AgencyModel.findById(agencyId);

  const isExpired = agency.subscription_expires_at &&
    new Date(agency.subscription_expires_at) < new Date();

  return {
    tier: agency.subscription_tier,
    expires_at: agency.subscription_expires_at,
    is_expired: isExpired,
    is_active: agency.is_active && !isExpired
  };
}

module.exports = {
  generateSlug,
  ensureUniqueSlug,
  registerAgency,
  getPublicInfo,
  getFullInfo,
  updateBranding,
  updateSettings,
  setupCustomDomain,
  verifyCustomDomain,
  generateApiKey,
  revokeApiKey,
  checkSubscription
};
