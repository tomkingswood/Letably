const express = require('express');
const router = express.Router();
const adminReportsController = require('../controllers/adminReportsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require admin authentication
router.use(authenticateToken, requireAdmin);

// Statement routes
router.get('/statements/periods', adminReportsController.getStatementPeriods);
router.get('/statements/:year/annual', adminReportsController.getAnnualSummary);
router.get('/statements/:year/annual/pdf', adminReportsController.downloadAnnualStatementPDF);
router.get('/statements/:year/:month', adminReportsController.getMonthlyStatement);

// Note: Report routes are now handled by unified /api/reports
// See backend/src/routes/reports.js

module.exports = router;
