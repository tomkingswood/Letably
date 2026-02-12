const express = require('express');
const router = express.Router();
const guarantorController = require('../controllers/guarantorController');
const { createRateLimiter } = require('../middleware/rateLimit');

// SECURITY: Rate limit public guarantor routes to prevent abuse
const guarantorLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 20, // 20 requests per 15 minutes per IP
  message: 'Too many requests. Please try again later.'
});

const guarantorSignLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // 10 sign attempts per hour per IP
  message: 'Too many signing attempts. Please try again later.'
});

// Public routes - no authentication required (token-based access)
// Get guarantor agreement by token
router.get('/:token', guarantorLimiter, guarantorController.getAgreementByToken);

// Sign guarantor agreement
router.post('/:token/sign', guarantorSignLimiter, guarantorController.signAgreement);

// Get signed agreement HTML
router.get('/:token/signed', guarantorLimiter, guarantorController.getSignedAgreement);

module.exports = router;
