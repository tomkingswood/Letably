const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/paymentsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Tenant routes (authenticated users)
router.get('/my-schedule', authenticateToken, paymentsController.getMyPaymentSchedule);

// Admin routes
router.use(authenticateToken, requireAdmin);

// Get all payment schedules (for calendar view)
router.get('/all', paymentsController.getAllPaymentSchedules);

// Get all payments for a tenancy
router.get('/tenancy/:tenancyId', paymentsController.getTenancyPayments);

// Get payment statistics for a tenancy
router.get('/tenancy/:tenancyId/stats', paymentsController.getTenancyPaymentStats);

// Create manual payment schedule
router.post('/', paymentsController.createManualPayment);

// Update payment amount
router.patch('/:paymentId/amount', paymentsController.updatePaymentAmount);

// Record a payment
router.put('/:paymentId', paymentsController.recordPayment);

// Delete payment schedule
router.delete('/:paymentId/schedule', paymentsController.deletePaymentSchedule);

// Update a single payment record
router.put('/:paymentId/payment/:singlePaymentId', paymentsController.updateSinglePayment);

// Delete a single payment record
router.delete('/:paymentId/payment/:singlePaymentId', paymentsController.deleteSinglePayment);

// Revert a payment (delete all payment records)
router.delete('/:paymentId', paymentsController.revertPayment);

module.exports = router;
