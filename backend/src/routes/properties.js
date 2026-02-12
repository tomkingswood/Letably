const express = require('express');
const router = express.Router();
const propertiesController = require('../controllers/propertiesController');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const { pdfUpload } = require('../middleware/uploadFactory');

// Public routes (with optional auth to allow admins to see drafts)
router.get('/', optionalAuth, propertiesController.getAllProperties);
router.get('/:id', optionalAuth, propertiesController.getPropertyById);

// Admin routes
router.post('/', authenticateToken, requireAdmin, propertiesController.createProperty);
router.put('/:id', authenticateToken, requireAdmin, propertiesController.updateProperty);
router.delete('/:id', authenticateToken, requireAdmin, propertiesController.deleteProperty);
router.patch('/reorder', authenticateToken, requireAdmin, propertiesController.updateDisplayOrder);

module.exports = router;
