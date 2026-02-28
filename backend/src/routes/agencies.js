/**
 * Agency Routes
 *
 * Routes for agency management, registration, and settings.
 */

const express = require('express');
const router = express.Router();
const agencyController = require('../controllers/agencyController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { agencyContext, requireAgency } = require('../middleware/agencyContext');
const { subscriptionCheck, requirePremium } = require('../middleware/subscriptionCheck');
const { authLimiter } = require('../middleware/rateLimit');

// Public routes

/**
 * Register new agency
 * POST /api/agencies/register
 */
router.post('/register', authLimiter, agencyController.register);

// Protected routes (require authentication)

/**
 * Get current agency info
 * GET /api/agencies/current
 */
router.get('/current',
  authenticateToken,
  agencyController.getCurrent
);

/**
 * Update agency branding
 * PUT /api/agencies/branding
 */
router.put('/branding',
  authenticateToken,
  requireAdmin,
  subscriptionCheck,
  agencyController.updateBranding
);

/**
 * Get agency settings
 * GET /api/agencies/settings
 */
router.get('/settings',
  authenticateToken,
  requireAdmin,
  agencyController.getSettings
);

/**
 * Update agency settings
 * PUT /api/agencies/settings
 */
router.put('/settings',
  authenticateToken,
  requireAdmin,
  subscriptionCheck,
  agencyController.updateSettings
);

/**
 * Generate API key
 * POST /api/agencies/api-key
 */
router.post('/api-key',
  authenticateToken,
  requireAdmin,
  agencyController.generateApiKey
);

/**
 * Revoke API key
 * DELETE /api/agencies/api-key
 */
router.delete('/api-key',
  authenticateToken,
  requireAdmin,
  agencyController.revokeApiKey
);

/**
 * Get subscription status
 * GET /api/agencies/subscription
 */
router.get('/subscription',
  authenticateToken,
  requireAdmin,
  agencyController.getSubscription
);

// Premium features

/**
 * Setup custom domain
 * POST /api/agencies/custom-domain
 */
router.post('/custom-domain',
  authenticateToken,
  requireAdmin,
  requirePremium,
  agencyController.setupCustomDomain
);

/**
 * Verify custom domain
 * POST /api/agencies/custom-domain/verify
 */
router.post('/custom-domain/verify',
  authenticateToken,
  requireAdmin,
  requirePremium,
  agencyController.verifyCustomDomain
);

/**
 * Get agency by slug (public info)
 * GET /api/agencies/:slug
 * NOTE: Must be last — :slug is a catch-all that would shadow specific routes above
 */
router.get('/:slug', agencyController.getBySlug);

module.exports = router;
