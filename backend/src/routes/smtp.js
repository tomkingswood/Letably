const express = require('express');
const router = express.Router();
const smtpController = require('../controllers/smtpController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All SMTP routes require admin authentication
router.use(authenticateToken, requireAdmin);

// Get SMTP settings
router.get('/settings', smtpController.getSmtpSettings);

// Update email mode (platform vs custom)
router.patch('/email-mode', smtpController.updateEmailMode);

// Update SMTP settings (custom mode)
router.put('/settings', smtpController.updateSmtpSettings);

// Test SMTP connection
router.post('/test-connection', smtpController.testSmtpConnection);

// Send test email
router.post('/test-email', smtpController.sendTestEmail);

module.exports = router;
