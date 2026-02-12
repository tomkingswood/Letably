/**
 * Branding Service
 *
 * Fetches agency branding information for emails, PDFs, and other branded content
 */

const db = require('../db');

/**
 * Get agency branding for emails and documents
 * @param {number} agencyId - Agency ID
 * @returns {Object} Branding object with companyName, email, phone, website, etc.
 */
async function getAgencyBranding(agencyId) {
  try {
    // Get agency info
    const agencyResult = await db.query(
      'SELECT name, slug, primary_color, logo_url FROM agencies WHERE id = $1',
      [agencyId],
      agencyId
    );
    const agency = agencyResult.rows[0];

    if (!agency) {
      return getDefaultBranding();
    }

    // Get site settings
    const settingsResult = await db.query(
      `SELECT setting_key, setting_value FROM site_settings WHERE agency_id = $1`,
      [agencyId],
      agencyId
    );

    const settings = {};
    for (const row of settingsResult.rows) {
      settings[row.setting_key] = row.setting_value;
    }

    // Build frontend URL for logo
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return {
      companyName: settings.company_name || agency.name || 'Letably',
      tagline: settings.tagline || '',
      email: settings.contact_email || '',
      phone: settings.contact_phone || '',
      website: settings.website || '',
      logoUrl: agency.logo_url ? `${frontendUrl}${agency.logo_url}` : null,
      primaryColor: agency.primary_color || '#1E3A5F',
      agencyName: agency.name,
      agencySlug: agency.slug,
    };
  } catch (err) {
    console.error('Error fetching agency branding:', err);
    return getDefaultBranding();
  }
}

/**
 * Get default Letably branding
 * @returns {Object} Default branding object
 */
function getDefaultBranding() {
  return {
    companyName: 'Letably',
    tagline: 'Property Management Platform',
    email: 'support@letably.com',
    phone: '',
    website: 'letably.com',
    logoUrl: null,
    primaryColor: '#1E3A5F',
    agencyName: 'Letably',
    agencySlug: '',
  };
}

module.exports = {
  getAgencyBranding,
  getDefaultBranding,
};
