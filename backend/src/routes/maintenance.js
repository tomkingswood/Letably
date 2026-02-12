const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { createAttachmentUpload } = require('../middleware/uploadFactory');

const uploadMiddleware = createAttachmentUpload({
  destination: 'uploads/maintenance',
  filePrefix: 'maintenance-',
});

// Public endpoint for categories/priorities/statuses
router.get('/options', maintenanceController.getCategories);

// ============================================
// TENANT ROUTES (authenticated users)
// ============================================
router.get('/my-requests', authenticateToken, maintenanceController.getMyRequests);
router.get('/requests/:id', authenticateToken, maintenanceController.getRequestById);
router.post('/requests', authenticateToken, maintenanceController.createRequest);

// Comments with attachments
router.post('/requests/:id/comments', authenticateToken, uploadMiddleware, maintenanceController.addComment);
router.post('/requests/:id/comments/:commentId/attachments', authenticateToken, uploadMiddleware, maintenanceController.uploadAttachments);

// ============================================
// ADMIN ROUTES
// ============================================
router.get('/admin', authenticateToken, requireAdmin, maintenanceController.getAllRequests);
router.get('/admin/:id', authenticateToken, requireAdmin, maintenanceController.getRequestByIdAdmin);
router.put('/admin/:id', authenticateToken, requireAdmin, maintenanceController.updateRequest);
router.delete('/admin/:id', authenticateToken, requireAdmin, maintenanceController.deleteRequest);

// Admin comments with attachments
router.post('/admin/:id/comments', authenticateToken, requireAdmin, uploadMiddleware, maintenanceController.addCommentAdmin);
router.post('/admin/:id/comments/:commentId/attachments', authenticateToken, requireAdmin, uploadMiddleware, maintenanceController.uploadAttachmentsAdmin);
router.delete('/admin/attachments/:attachmentId', authenticateToken, requireAdmin, maintenanceController.deleteAttachment);
router.delete('/admin/comments/:commentId', authenticateToken, requireAdmin, maintenanceController.deleteComment);

// Tenancy-specific requests
router.get('/admin/tenancy/:tenancyId', authenticateToken, requireAdmin, maintenanceController.getRequestsByTenancy);

module.exports = router;
