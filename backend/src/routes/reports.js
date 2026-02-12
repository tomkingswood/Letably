/**
 * Reports Routes
 *
 * Unified report endpoints that work for both admin and landlord users.
 * Security is handled by the report framework based on user role.
 *
 * All endpoints require authentication via authenticateToken middleware.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const reportsController = require('../controllers/reportsController');

// All report routes require authentication
router.use(authenticateToken);

/**
 * GET /api/reports/types
 * Get available report types for the current user's role
 */
router.get('/types', reportsController.getAvailableReportTypes);

/**
 * GET /api/reports/overview
 * Portfolio overview report
 *
 * Query params:
 *   - landlord_id: Filter by landlord (admin only)
 *   - property_id: Filter by property
 *   - include_room_details: Include room-level details (default: true)
 */
router.get('/overview', reportsController.getPortfolioOverview);

/**
 * GET /api/reports/occupancy
 * Detailed occupancy report with tenant information
 *
 * Query params:
 *   - landlord_id: Filter by landlord (admin only)
 *   - property_id: Filter by property
 *   - include_next_tenant: Include next tenant info (default: true)
 */
router.get('/occupancy', reportsController.getOccupancyReport);

/**
 * GET /api/reports/financial
 * Financial report with monthly breakdown
 *
 * Query params:
 *   - landlord_id: Filter by landlord (admin only)
 *   - property_id: Filter by property
 *   - year: Report year (default: current year)
 *   - month: Specific month (optional, if not provided returns full year)
 *   - group_by_property: Include property breakdown (default: true)
 */
router.get('/financial', reportsController.getFinancialReport);

/**
 * GET /api/reports/arrears
 * Arrears report showing tenants with overdue payments
 *
 * Query params:
 *   - landlord_id: Filter by landlord (admin only)
 *   - property_id: Filter by property
 */
router.get('/arrears', reportsController.getArrearsReport);

/**
 * GET /api/reports/upcoming-endings
 * Tenancies ending within specified period
 *
 * Query params:
 *   - landlord_id: Filter by landlord (admin only)
 *   - property_id: Filter by property
 *   - days: Days ahead to look (default: 90)
 */
router.get('/upcoming-endings', reportsController.getUpcomingEndings);

// ============================================
// CSV Export Endpoints
// ============================================

/**
 * GET /api/reports/overview/export
 * Export portfolio overview to CSV
 */
router.get('/overview/export', reportsController.exportPortfolioOverview);

/**
 * GET /api/reports/occupancy/export
 * Export occupancy report to CSV
 */
router.get('/occupancy/export', reportsController.exportOccupancyReport);

/**
 * GET /api/reports/financial/export
 * Export financial report to CSV (monthly breakdown)
 */
router.get('/financial/export', reportsController.exportFinancialReport);

/**
 * GET /api/reports/financial/export-by-property
 * Export financial report to CSV (grouped by property)
 */
router.get('/financial/export-by-property', reportsController.exportFinancialByProperty);

/**
 * GET /api/reports/arrears/export
 * Export arrears report to CSV
 */
router.get('/arrears/export', reportsController.exportArrearsReport);

/**
 * GET /api/reports/upcoming-endings/export
 * Export upcoming endings report to CSV
 */
router.get('/upcoming-endings/export', reportsController.exportUpcomingEndings);

/**
 * GET /api/reports/:type/export-formats
 * Get available export formats for a report type
 */
router.get('/:type/export-formats', reportsController.getExportFormatsForType);

module.exports = router;
