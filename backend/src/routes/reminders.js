const express = require('express');
const router = express.Router();
const remindersController = require('../controllers/remindersController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require authentication and admin privileges

// Threshold settings
router.get('/thresholds', authenticateToken, requireAdmin, remindersController.getThresholds);
router.put('/thresholds', authenticateToken, requireAdmin, remindersController.updateThresholds);
router.patch('/thresholds/reorder', authenticateToken, requireAdmin, remindersController.reorderThresholds);

// Get all active reminders
router.get('/', authenticateToken, requireAdmin, remindersController.getAllReminders);
router.get('/count', authenticateToken, requireAdmin, remindersController.getReminderCount);

// Manual reminders CRUD
router.get('/manual', authenticateToken, requireAdmin, remindersController.getAllManualReminders);
router.post('/manual', authenticateToken, requireAdmin, remindersController.createManualReminder);
router.put('/manual/:id', authenticateToken, requireAdmin, remindersController.updateManualReminder);
router.delete('/manual/:id', authenticateToken, requireAdmin, remindersController.deleteManualReminder);

// Process and send reminder emails
router.post('/process-emails', authenticateToken, requireAdmin, remindersController.processEmails);

module.exports = router;
