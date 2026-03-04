const express = require('express');
const router = express.Router();
const bedroomAttributesController = require('../controllers/bedroomAttributesController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require admin authentication
router.get('/definitions', authenticateToken, requireAdmin, bedroomAttributesController.getDefinitions);
router.post('/definitions', authenticateToken, requireAdmin, bedroomAttributesController.createDefinition);
router.put('/definitions/:id', authenticateToken, requireAdmin, bedroomAttributesController.updateDefinition);
router.delete('/definitions/:id', authenticateToken, requireAdmin, bedroomAttributesController.deleteDefinition);
router.patch('/definitions/reorder', authenticateToken, requireAdmin, bedroomAttributesController.reorderDefinitions);

module.exports = router;
