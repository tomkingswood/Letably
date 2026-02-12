const express = require('express');
const router = express.Router();
const {
  getAllSettings,
  getViewingSettings,
  updateSettings,
  uploadCmpCertificate,
  uploadPrsCertificate,
  uploadPrivacyPolicy,
  uploadIcoCertificate
} = require('../controllers/settingsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { legalDocumentUpload } = require('../middleware/uploadFactory');

// Authenticated - get all settings (needs agency context)
router.get('/', authenticateToken, getAllSettings);

// Authenticated - get viewing settings only (needs agency context)
router.get('/viewing', authenticateToken, getViewingSettings);

// Admin only - update settings
router.put('/', authenticateToken, requireAdmin, updateSettings);

// Admin only - upload CMP certificate
router.post('/upload-cmp-certificate', authenticateToken, requireAdmin, legalDocumentUpload.single('file'), uploadCmpCertificate);

// Admin only - upload PRS certificate
router.post('/upload-prs-certificate', authenticateToken, requireAdmin, legalDocumentUpload.single('file'), uploadPrsCertificate);

// Admin only - upload privacy policy
router.post('/upload-privacy-policy', authenticateToken, requireAdmin, legalDocumentUpload.single('file'), uploadPrivacyPolicy);

// Admin only - upload ICO certificate
router.post('/upload-ico-certificate', authenticateToken, requireAdmin, legalDocumentUpload.single('file'), uploadIcoCertificate);

module.exports = router;
