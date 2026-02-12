const express = require('express');
const router = express.Router();
const imagesController = require('../controllers/imagesController');
const { imageUpload } = require('../middleware/uploadFactory');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Authenticated routes (need agency context from JWT)
router.get('/property/:propertyId', authenticateToken, imagesController.getPropertyImages);
router.get('/bedroom/:bedroomId', authenticateToken, imagesController.getBedroomImages);

// Admin routes - all write operations require property images feature flag
const adminImageMiddleware = [authenticateToken, requireAdmin, imagesController.requirePropertyImagesEnabled];
router.post('/', ...adminImageMiddleware, imageUpload.array('images', 10), imagesController.uploadImages);
router.put('/:id/primary', ...adminImageMiddleware, imagesController.setPrimaryImage);
router.delete('/:id', ...adminImageMiddleware, imagesController.deleteImage);
router.post('/link-to-bedroom', ...adminImageMiddleware, imagesController.linkImageToBedroom);
router.post('/unlink-from-bedroom', ...adminImageMiddleware, imagesController.unlinkImageFromBedroom);

module.exports = router;
