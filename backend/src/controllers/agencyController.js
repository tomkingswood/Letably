/**
 * Agency Controller
 *
 * Handles agency registration, settings, and branding.
 */

const agencyService = require('../services/agencyService');
const AgencyModel = require('../models/agency');
const handleError = require('../utils/handleError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Register new agency
 *
 * POST /api/agencies/register
 */
exports.register = async (req, res) => {
  try {
    const {
      agency_name,
      agency_email,
      agency_phone,
      admin_email,
      admin_password,
      admin_first_name,
      admin_last_name,
      admin_phone
    } = req.body;

    // Validation
    if (!agency_name || !agency_email || !admin_email || !admin_password || !admin_first_name || !admin_last_name) {
      return res.status(400).json({ error: 'Missing required fields: agency_name, agency_email, admin_email, admin_password, admin_first_name, admin_last_name' });
    }

    // Password validation
    if (admin_password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const result = await agencyService.registerAgency({
      agency_name,
      agency_email,
      agency_phone,
      admin_email,
      admin_password,
      admin_first_name,
      admin_last_name,
      admin_phone
    });

    res.status(201).json({
      message: 'Agency registered successfully',
      agency: {
        id: result.agency.id,
        name: result.agency.name,
        slug: result.agency.slug,
        email: result.agency.email
      },
      admin: result.admin,
      login_url: `/${result.agency.slug}/login`
    });
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation
      return res.status(400).json({ error: 'Agency with this email or slug already exists' });
    }

    handleError(res, err, 'register agency');
  }
};

/**
 * Get agency by slug (public info)
 *
 * GET /api/agencies/:slug
 */
exports.getBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const agency = await agencyService.getPublicInfo(slug);

  if (!agency) {
    return res.status(404).json({ error: 'Agency not found' });
  }

  if (!agency.is_active) {
    return res.status(403).json({ error: 'This agency is currently inactive' });
  }

  res.json({ agency });
}, 'get agency');

/**
 * Get current agency info (authenticated admin)
 *
 * GET /api/agencies/current
 */
exports.getCurrent = asyncHandler(async (req, res) => {
  const result = await agencyService.getFullInfo(req.agencyId);

  res.json(result);
}, 'get current agency');

/**
 * Update agency branding
 *
 * PUT /api/agencies/branding
 */
exports.updateBranding = async (req, res) => {
  try {
    const { logo_url, primary_color, secondary_color, show_powered_by } = req.body;

    const agency = await agencyService.updateBranding(req.agencyId, {
      logo_url,
      primary_color,
      secondary_color,
      show_powered_by
    });

    res.json({
      message: 'Branding updated successfully',
      agency: {
        logo_url: agency.logo_url,
        primary_color: agency.primary_color,
        secondary_color: agency.secondary_color,
        show_powered_by: agency.show_powered_by
      }
    });
  } catch (err) {
    if (err.message.includes('Invalid')) {
      return res.status(400).json({ error: err.message });
    }

    handleError(res, err, 'update branding');
  }
};

/**
 * Get agency settings
 *
 * GET /api/agencies/settings
 */
exports.getSettings = asyncHandler(async (req, res) => {
  const result = await agencyService.getFullInfo(req.agencyId);

  res.json({ settings: result.settings });
}, 'get settings');

/**
 * Update agency settings
 *
 * PUT /api/agencies/settings
 */
exports.updateSettings = asyncHandler(async (req, res) => {
  const settings = await agencyService.updateSettings(req.agencyId, req.body);

  res.json({
    message: 'Settings updated successfully',
    settings
  });
}, 'update settings');

/**
 * Generate API key
 *
 * POST /api/agencies/api-key
 */
exports.generateApiKey = asyncHandler(async (req, res) => {
  const apiKey = await agencyService.generateApiKey(req.agencyId);

  res.json({
    message: 'API key generated',
    api_key: apiKey,
    note: 'Save this key securely. It will not be shown again.'
  });
}, 'generate API key');

/**
 * Revoke API key
 *
 * DELETE /api/agencies/api-key
 */
exports.revokeApiKey = asyncHandler(async (req, res) => {
  await agencyService.revokeApiKey(req.agencyId);

  res.json({ message: 'API key revoked' });
}, 'revoke API key');

/**
 * Setup custom domain (premium feature)
 *
 * POST /api/agencies/custom-domain
 */
exports.setupCustomDomain = async (req, res) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    // Check premium subscription
    const agency = await AgencyModel.findById(req.agencyId);
    if (agency.subscription_tier !== 'premium') {
      return res.status(403).json({ error: 'Custom domains require a premium subscription' });
    }

    const result = await agencyService.setupCustomDomain(req.agencyId, domain);

    res.json({
      message: 'Domain configured. Please add the DNS record to verify ownership.',
      ...result
    });
  } catch (err) {
    if (err.message.includes('Invalid') || err.message.includes('already in use')) {
      return res.status(400).json({ error: err.message });
    }

    handleError(res, err, 'setup custom domain');
  }
};

/**
 * Verify custom domain
 *
 * POST /api/agencies/custom-domain/verify
 */
exports.verifyCustomDomain = asyncHandler(async (req, res) => {
  const result = await agencyService.verifyCustomDomain(req.agencyId);

  res.json({
    message: result.verified ? 'Domain verified successfully' : 'Domain verification failed',
    verified: result.verified
  });
}, 'verify custom domain');

/**
 * Check subscription status
 *
 * GET /api/agencies/subscription
 */
exports.getSubscription = asyncHandler(async (req, res) => {
  const status = await agencyService.checkSubscription(req.agencyId);

  res.json({ subscription: status });
}, 'get subscription');

module.exports = exports;
