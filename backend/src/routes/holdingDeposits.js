const express = require('express');
const router = express.Router();
const controller = require('../controllers/holdingDepositController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require admin authentication
router.post('/', authenticateToken, requireAdmin, controller.createDeposit);
router.get('/', authenticateToken, requireAdmin, controller.getAllDeposits);
router.get('/application/:applicationId', authenticateToken, requireAdmin, controller.getByApplication);
router.get('/:id', authenticateToken, requireAdmin, controller.getById);
router.patch('/:id/status', authenticateToken, requireAdmin, controller.updateStatus);

module.exports = router;
