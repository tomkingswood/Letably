const express = require('express');
const router = express.Router();
const landlordsController = require('../controllers/landlordsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All landlord routes require admin authentication
router.use(authenticateToken, requireAdmin);

// Get all landlords
router.get('/', landlordsController.getAllLandlords);

// Create landlord
router.post('/', landlordsController.createLandlord);

// Get single landlord (validate id is a number to avoid catching /new etc)
router.get('/:id(\\d+)', landlordsController.getLandlordById);

// Generate preview agreement for landlord (POST to support custom test data)
router.post('/:id(\\d+)/preview-agreement', landlordsController.generatePreviewAgreement);

// Update landlord
router.put('/:id(\\d+)', landlordsController.updateLandlord);

// Delete landlord
router.delete('/:id(\\d+)', landlordsController.deleteLandlord);

module.exports = router;
