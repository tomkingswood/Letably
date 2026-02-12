const express = require('express');
const router = express.Router();
const certificateTypesController = require('../controllers/certificateTypesController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all certificate types (authenticated - needs agency context)
router.get('/', authenticateToken, certificateTypesController.getAll);

// Get single certificate type
router.get('/:id', authenticateToken, certificateTypesController.getById);

// Admin only routes
router.post('/', authenticateToken, requireAdmin, certificateTypesController.create);
router.put('/:id', authenticateToken, requireAdmin, certificateTypesController.update);
router.delete('/:id', authenticateToken, requireAdmin, certificateTypesController.delete);
router.post('/reorder', authenticateToken, requireAdmin, certificateTypesController.reorder);

module.exports = router;
