const express = require('express');
const router = express.Router();
const propertyAttributesController = require('../controllers/propertyAttributesController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require admin authentication
router.get('/definitions', authenticateToken, requireAdmin, propertyAttributesController.getDefinitions);
router.post('/definitions', authenticateToken, requireAdmin, propertyAttributesController.createDefinition);
router.put('/definitions/:id', authenticateToken, requireAdmin, propertyAttributesController.updateDefinition);
router.delete('/definitions/:id', authenticateToken, requireAdmin, propertyAttributesController.deleteDefinition);
router.patch('/definitions/reorder', authenticateToken, requireAdmin, propertyAttributesController.reorderDefinitions);

module.exports = router;
