const express = require('express');
const router = express.Router();
const applicationsController = require('../controllers/applicationsController');
const pdfGeneratorController = require('../controllers/pdfGeneratorController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Public guarantor routes (no authentication required)
router.get('/guarantor/:token', applicationsController.getApplicationByGuarantorToken);
router.post('/guarantor/:token', applicationsController.submitGuarantorForm);

// Admin routes
router.post('/', authenticateToken, requireAdmin, applicationsController.createApplication);
router.get('/all', authenticateToken, requireAdmin, applicationsController.getAllApplications);
router.get('/admin/:id', authenticateToken, requireAdmin, applicationsController.getApplicationByIdAdmin);
router.delete('/:id', authenticateToken, requireAdmin, applicationsController.deleteApplication);
router.post('/:id/regenerate-guarantor-token', authenticateToken, requireAdmin, applicationsController.regenerateGuarantorToken);
router.post('/:id/approve', authenticateToken, requireAdmin, applicationsController.approveApplication);
router.get('/:id/generate-pdf', authenticateToken, requireAdmin, pdfGeneratorController.generateApplicationPDF);

// File cleanup endpoint - manual trigger for admin
router.post('/cleanup-orphaned-files', authenticateToken, requireAdmin, applicationsController.cleanupOrphanedFiles);

// User routes
router.get('/my-applications', authenticateToken, applicationsController.getUserApplications);
router.get('/:id', authenticateToken, applicationsController.getApplicationById);
router.put('/:id', authenticateToken, applicationsController.updateApplication);

module.exports = router;
