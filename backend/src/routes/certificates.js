const express = require('express');
const router = express.Router();
const certificatesController = require('../controllers/certificatesController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require authentication and admin privileges
router.use(authenticateToken, requireAdmin);

// Get certificates for an entity (property, agency, etc.)
router.get('/entity/:entityType/:entityId', certificatesController.getByEntity);

// Get certificate types with latest documents for an entity type
router.get('/with-types/:entityType', certificatesController.getWithTypes);

// Upload/update certificate for an entity
router.post('/entity/:entityType/:entityId/upload/:typeId', certificatesController.uploadCertificate);

// Update certificate expiry date
router.put('/entity/:entityType/:entityId/:typeId/expiry', certificatesController.updateExpiryDate);

// Delete certificate
router.delete('/entity/:entityType/:entityId/:typeId', certificatesController.deleteCertificate);

// Download certificate file
router.get('/:id/download', certificatesController.download);

module.exports = router;
