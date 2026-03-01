const express = require('express');
const router = express.Router();
const controller = require('../controllers/holdingDepositController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Tenant-accessible route (authenticated, not admin-only)
router.get('/my-application/:applicationId', authenticateToken, controller.getByApplicationForTenant);

// Admin routes
router.post('/', authenticateToken, requireAdmin, controller.createDeposit);
router.get('/', authenticateToken, requireAdmin, controller.getAllDeposits);
router.get('/application/:applicationId', authenticateToken, requireAdmin, controller.getByApplication);
router.get('/:id', authenticateToken, requireAdmin, controller.getById);
router.patch('/:id/record-payment', authenticateToken, requireAdmin, controller.recordPayment);
router.patch('/:id/undo-payment', authenticateToken, requireAdmin, controller.undoPayment);
router.patch('/:id/status', authenticateToken, requireAdmin, controller.updateStatus);

module.exports = router;
