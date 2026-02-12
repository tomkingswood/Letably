const express = require('express');
const router = express.Router();
const tenantDocumentsController = require('../controllers/tenantDocumentsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Admin routes
router.post('/', authenticateToken, requireAdmin, tenantDocumentsController.uploadDocument);
router.get('/member/:memberId', authenticateToken, requireAdmin, tenantDocumentsController.getMemberDocuments);
router.delete('/:id', authenticateToken, requireAdmin, tenantDocumentsController.deleteDocument);

// Tenant routes
router.get('/my-documents', authenticateToken, tenantDocumentsController.getMyDocuments);

// Download route (both admin and tenant)
router.get('/:id/download', authenticateToken, tenantDocumentsController.downloadDocument);

module.exports = router;
