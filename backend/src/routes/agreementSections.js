const express = require('express');
const router = express.Router();
const agreementSectionsController = require('../controllers/agreementSectionsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All agreement section routes require admin authentication
router.use(authenticateToken, requireAdmin);

// Get all agreement sections (with optional landlord_id query param)
router.get('/', agreementSectionsController.getAllSections);

// Preview default sections only (no landlord overrides)
router.get('/preview-default', agreementSectionsController.previewDefaultAgreement);

// Get sections for a specific landlord (including defaults)
router.get('/landlord/:landlord_id', agreementSectionsController.getSectionsForLandlord);

// Get single agreement section
router.get('/:id', agreementSectionsController.getSectionById);

// Create agreement section
router.post('/', agreementSectionsController.createSection);

// Duplicate agreement section
router.post('/:id/duplicate', agreementSectionsController.duplicateSection);

// Update agreement section
router.put('/:id', agreementSectionsController.updateSection);

// Delete agreement section
router.delete('/:id', agreementSectionsController.deleteSection);

module.exports = router;
