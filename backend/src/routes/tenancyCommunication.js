const express = require('express');
const router = express.Router();
const commController = require('../controllers/tenancyCommunicationController');
const { authenticateToken, requireAdmin, requireLandlord } = require('../middleware/auth');
const { createAttachmentUpload } = require('../middleware/uploadFactory');

const uploadMiddleware = createAttachmentUpload({
  destination: 'uploads/tenancy-communications',
  filePrefix: 'comm-',
});

// ============================================
// TENANT ROUTES
// ============================================

// Get messages for tenant's active tenancy
router.get('/my-thread', authenticateToken, commController.getMyThread);

// Send message to tenant's tenancy thread (with optional multi-file upload)
router.post('/my-thread/messages', authenticateToken, uploadMiddleware, commController.sendMessage);

// ============================================
// LANDLORD ROUTES
// ============================================

// Get all tenancies for landlord (with message counts)
router.get('/landlord/tenancies', authenticateToken, requireLandlord, commController.getLandlordTenancies);

// Get messages for a specific tenancy
router.get('/landlord/:tenancyId', authenticateToken, requireLandlord, commController.getLandlordThread);

// Send message as landlord (with optional multi-file upload)
router.post('/landlord/:tenancyId/messages', authenticateToken, requireLandlord, uploadMiddleware, commController.sendMessageLandlord);

// ============================================
// ADMIN ROUTES
// ============================================

// Get all tenancies with communication (list view)
router.get('/admin/tenancies', authenticateToken, requireAdmin, commController.getAllTenanciesWithCommunication);

// Get messages for any tenancy
router.get('/admin/:tenancyId', authenticateToken, requireAdmin, commController.getAdminThread);

// Send message as admin (with optional multi-file upload)
router.post('/admin/:tenancyId/messages', authenticateToken, requireAdmin, uploadMiddleware, commController.sendMessageAdmin);

// Delete message (admin only)
router.delete('/admin/messages/:messageId', authenticateToken, requireAdmin, commController.deleteMessage);

// Delete attachment (admin only)
router.delete('/admin/attachments/:attachmentId', authenticateToken, requireAdmin, commController.deleteAttachment);

module.exports = router;
