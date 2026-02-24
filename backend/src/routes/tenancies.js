const express = require('express');
const router = express.Router();
const tenanciesController = require('../controllers/tenanciesController');
const tenantPortalController = require('../controllers/tenantPortalController');
const tenancyMembersController = require('../controllers/tenancyMembersController');
const tenancySigningController = require('../controllers/tenancySigningController');
const tenancyGuarantorController = require('../controllers/tenancyGuarantorController');
const tenancyVariationsController = require('../controllers/tenancyVariationsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Tenant routes (authenticated users)
router.get('/my-status', authenticateToken, tenantPortalController.getMyStatus);
router.get('/my-pending-agreements', authenticateToken, tenantPortalController.getPendingAgreements);
router.get('/my-pending-tenancies', authenticateToken, tenantPortalController.getMyPendingTenancies);
router.get('/my-tenancy', authenticateToken, tenantPortalController.getMyActiveTenancy);
router.get('/:tenancyId/members/:memberId/sign', authenticateToken, tenantPortalController.getTenantAgreement);
router.post('/:tenancyId/members/:memberId/sign', authenticateToken, tenancySigningController.signAgreement);

// Admin routes
router.use(authenticateToken, requireAdmin);

// Get all tenancies
router.get('/', tenanciesController.getAllTenancies);

// Get completed applications grouped by property (for creating tenancies) - LEGACY
router.get('/completed-applications', tenanciesController.getCompletedApplicationsByProperty);

// Get all approved applicants (not grouped by property) - NEW
router.get('/approved-applicants', tenanciesController.getApprovedApplicants);

// Get single tenancy
router.get('/:id', tenanciesController.getTenancyById);

// Create tenancy
router.post('/', tenanciesController.createTenancy);

// Create migration tenancy (no application required, starts as active)
router.post('/migration', tenancyVariationsController.createMigrationTenancy);

// Update tenancy
router.put('/:id', tenanciesController.updateTenancy);

// Update tenancy member
router.put('/:id/members/:memberId', tenancyMembersController.updateTenancyMember);

// Update member key tracking
router.put('/:id/members/:memberId/key-tracking', tenancyMembersController.updateMemberKeyTracking);

// Revert single member signature (admin only)
router.post('/:id/members/:memberId/revert-signature', tenancySigningController.revertMemberSignature);

// Create deposit return schedules
router.post('/:id/deposit-return-schedules', tenancySigningController.createDepositReturnSchedules);

// Get guarantor agreements for tenancy
router.get('/:id/guarantor-agreements', tenancyGuarantorController.getGuarantorAgreements);

// Regenerate guarantor agreement token and resend email
router.post('/:id/guarantor-agreements/:agreementId/regenerate-token', tenancyGuarantorController.regenerateGuarantorAgreementToken);

// Delete tenancy
router.delete('/:id', tenanciesController.deleteTenancy);

// Generate tenancy agreement (legacy - generates for first tenant)
router.get('/:id/agreement', tenancySigningController.generateTenancyAgreement);

// Generate tenancy agreement for specific member
router.get('/:id/members/:memberId/agreement', tenancySigningController.generateTenancyMemberAgreement);

// Create rolling tenancy from existing tenancy
router.post('/:id/create-rolling', tenancyVariationsController.createRollingTenancyFromExisting);

module.exports = router;
