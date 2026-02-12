const express = require('express');
const router = express.Router();
const bedroomsController = require('../controllers/bedroomsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get bedrooms for a property (authenticated - needs agency context)
router.get('/property/:propertyId', authenticateToken, bedroomsController.getBedroomsByProperty);

// Admin routes
router.post('/property/:propertyId', authenticateToken, requireAdmin, bedroomsController.createBedroom);
router.put('/:id', authenticateToken, requireAdmin, bedroomsController.updateBedroom);
router.delete('/:id', authenticateToken, requireAdmin, bedroomsController.deleteBedroom);
router.patch('/property/:propertyId/reorder', authenticateToken, requireAdmin, bedroomsController.reorderBedrooms);

module.exports = router;
