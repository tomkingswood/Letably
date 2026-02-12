/**
 * Super Admin Routes
 *
 * All routes for Letably platform staff.
 * These routes are separate from agency-scoped routes.
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const superController = require('../controllers/superController');
const { authenticateSuperUser } = require('../middleware/superAuth');

// Rate limit for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: { error: 'Too many login attempts, please try again later' }
});

// ==================== Public Routes ====================

// Login (rate limited)
router.post('/auth/login', loginLimiter, superController.login);

// ==================== Protected Routes ====================
// All routes below require super admin authentication

// Auth
router.get('/auth/me', authenticateSuperUser, superController.getCurrentUser);

// Platform stats
router.get('/stats', authenticateSuperUser, superController.getPlatformStats);

// Agencies
router.get('/agencies', authenticateSuperUser, superController.listAgencies);
router.get('/agencies/:id', authenticateSuperUser, superController.getAgency);
router.patch('/agencies/:id/status', authenticateSuperUser, superController.toggleAgencyStatus);
router.patch('/agencies/:id/subscription', authenticateSuperUser, superController.updateAgencySubscription);
router.patch('/agencies/:id/property-images', authenticateSuperUser, superController.togglePropertyImages);
router.get('/agencies/:id/storage', authenticateSuperUser, superController.getAgencyStorageUsage);
router.get('/agencies/:id/users', authenticateSuperUser, superController.getAgencyUsers);
router.post('/agencies/:id/impersonate/:userId', authenticateSuperUser, superController.impersonateUser);

// Super users management
router.get('/users', authenticateSuperUser, superController.listSuperUsers);
router.post('/users', authenticateSuperUser, superController.createSuperUser);

// Audit log
router.get('/audit-log', authenticateSuperUser, superController.getAuditLog);

// ==================== Email Queue Management ====================
// Platform-wide email queue (all agencies)

// SMTP Settings (from .env - read-only)
router.get('/email/smtp-settings', authenticateSuperUser, superController.getSmtpSettings);
router.post('/email/test-connection', authenticateSuperUser, superController.testSmtpConnection);
router.post('/email/test-send', authenticateSuperUser, superController.sendTestEmail);

// Email Queue
router.get('/email/queue', authenticateSuperUser, superController.getEmailQueue);
router.get('/email/queue/stats', authenticateSuperUser, superController.getEmailQueueStats);
router.post('/email/queue/:id/retry', authenticateSuperUser, superController.retryEmail);
router.delete('/email/queue/:id', authenticateSuperUser, superController.deleteEmail);
router.delete('/email/queue/bulk', authenticateSuperUser, superController.bulkDeleteEmails);

module.exports = router;
