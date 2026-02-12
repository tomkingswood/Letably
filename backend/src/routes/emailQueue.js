const express = require('express');
const router = express.Router();
const emailQueueController = require('../controllers/emailQueueController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All email queue routes require admin authentication
router.use(authenticateToken, requireAdmin);

// Get queue statistics
router.get('/stats', emailQueueController.getQueueStats);

// Get processor status
router.get('/processor-status', emailQueueController.getProcessorStatus);

// Get all emails from queue
router.get('/', emailQueueController.getAllEmails);

// Process email queue manually
router.post('/process', emailQueueController.processEmailQueue);

// Delete all sent and failed emails (must be before /:id to avoid matching)
router.delete('/delete-processed', emailQueueController.deleteAllProcessed);

// Delete ALL emails including pending (must be before /:id to avoid matching)
router.delete('/delete-all', emailQueueController.deleteAll);

// Get single email details
router.get('/:id', emailQueueController.getEmailById);

// Preview email HTML
router.get('/:id/preview', emailQueueController.previewEmail);

// Retry failed email
router.post('/:id/retry', emailQueueController.retryEmail);

// Delete email from queue
router.delete('/:id', emailQueueController.deleteEmail);

module.exports = router;
