const express = require('express');
const router = express.Router();
const viewingRequestsController = require('../controllers/viewingRequestsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { viewingRequestLimiter } = require('../middleware/rateLimit');

// Public route with rate limiting
router.post('/', viewingRequestLimiter, viewingRequestsController.createViewingRequest);

// Admin routes
router.post('/admin', authenticateToken, requireAdmin, viewingRequestsController.createViewingRequestAdmin);
router.get('/', authenticateToken, requireAdmin, viewingRequestsController.getAllViewingRequests);
router.get('/count/pending', authenticateToken, requireAdmin, viewingRequestsController.getPendingCount);
router.get('/calendar', authenticateToken, requireAdmin, viewingRequestsController.getViewingsByDateRange);
router.patch('/:id/status', authenticateToken, requireAdmin, viewingRequestsController.updateViewingRequestStatus);
router.patch('/:id/date', authenticateToken, requireAdmin, viewingRequestsController.updateViewingDate);
router.patch('/:id/notes', authenticateToken, requireAdmin, viewingRequestsController.updateViewingNotes);
router.delete('/:id', authenticateToken, requireAdmin, viewingRequestsController.deleteViewingRequest);
router.post('/bulk-delete', authenticateToken, requireAdmin, viewingRequestsController.bulkDeleteViewingRequests);

module.exports = router;
