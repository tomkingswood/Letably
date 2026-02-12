const express = require('express');
const router = express.Router();
const landlordPanelController = require('../controllers/landlordPanelController');
const { authenticateToken, requireLandlord, attachLandlord } = require('../middleware/auth');
const { createAttachmentUpload } = require('../middleware/uploadFactory');

const uploadMiddleware = createAttachmentUpload({
  destination: 'uploads/maintenance',
});

// All routes require landlord authentication and landlord lookup
router.use(authenticateToken, requireLandlord, attachLandlord);

// Get landlord info
router.get('/info', landlordPanelController.getLandlordInfo);

// Get all active tenancies for landlord
router.get('/tenancies', landlordPanelController.getLandlordTenancies);

// Get tenancy details with tenant information
router.get('/tenancies/:id', landlordPanelController.getTenancyDetails);

// Get payment schedules for landlord's properties
router.get('/payment-schedules', landlordPanelController.getPaymentSchedules);

// Maintenance routes
router.get('/maintenance', landlordPanelController.getMaintenanceRequests);
router.get('/maintenance/:id', landlordPanelController.getMaintenanceRequestById);
router.put('/maintenance/:id', landlordPanelController.updateMaintenanceRequest);
router.post('/maintenance/:id/comments', uploadMiddleware, landlordPanelController.addMaintenanceComment);

// Statement routes
router.get('/statements/periods', landlordPanelController.getStatementPeriods);
router.get('/statements/:year/annual', landlordPanelController.getAnnualSummary);
router.get('/statements/:year/annual/pdf', landlordPanelController.downloadAnnualStatementPDF);
router.get('/statements/:year/:month', landlordPanelController.getMonthlyStatement);
router.get('/statements/:year/:month/pdf', landlordPanelController.downloadMonthlyStatementPDF);

// Note: Reports are now handled by unified /api/reports endpoints
// See backend/src/routes/reports.js

module.exports = router;
