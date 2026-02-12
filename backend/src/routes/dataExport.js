/**
 * Data Export Routes
 *
 * API routes for data export functionality.
 */

const express = require('express');
const router = express.Router();
const dataExportController = require('../controllers/dataExportController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All data export routes require admin authentication
router.use(authenticateToken, requireAdmin);

// Get export job statistics
router.get('/stats', dataExportController.getStats);

// Get available export options (entity types, filters)
router.get('/options', dataExportController.getOptions);

// Get all export jobs
router.get('/', dataExportController.getAllExports);

// Create new export job
router.post('/', dataExportController.createExport);

// Manually trigger queue processing (for testing)
router.post('/process', dataExportController.processQueueManually);

// Get single export job details
router.get('/:id', dataExportController.getExportById);

// Download completed export file
router.get('/:id/download', dataExportController.downloadExport);

// Retry failed export job
router.post('/:id/retry', dataExportController.retryExport);

// Delete export job
router.delete('/:id', dataExportController.deleteExport);

module.exports = router;
