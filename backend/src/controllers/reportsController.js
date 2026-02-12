/**
 * Reports Controller
 *
 * Unified controller for all report endpoints.
 * Works for both admin and landlord users - security handled by report framework.
 *
 * SECURITY:
 * - Role-based access control in report framework
 * - Landlord users automatically filtered to their own data
 * - Admin users can filter by landlord or see all
 */

const {
  createAndGenerate,
  buildContextFromRequest,
  parseFiltersFromQuery,
  parseOptionsFromQuery,
  getAvailableReports,
  ReportError,
} = require('../services/reports');

const { exportToCSV, getExportFormats } = require('../services/reports/csvExporter');

/**
 * Factory to create report endpoint handlers
 * Reduces boilerplate for each report type
 */
function createReportHandler(reportType) {
  return async (req, res) => {
    try {
      const context = buildContextFromRequest(req);
      const filters = parseFiltersFromQuery(req.query);
      const options = parseOptionsFromQuery(req.query);

      const report = createAndGenerate(reportType, context, filters, options);

      res.json({ report });
    } catch (error) {
      handleReportError(error, res);
    }
  };
}

/**
 * Centralized error handling for report endpoints
 */
function handleReportError(error, res) {
  if (error instanceof ReportError) {
    const statusCodes = {
      INVALID_REPORT_TYPE: 400,
      ACCESS_DENIED: 403,
      MISSING_LANDLORD_ID: 401,
      NOT_AUTHENTICATED: 401,
      NO_GENERATOR: 500,
      GENERATION_FAILED: 500,
    };

    const status = statusCodes[error.code] || 500;
    return res.status(status).json({
      error: error.message,
      code: error.code,
    });
  }

  // Unexpected error
  console.error('Report generation error:', error);
  res.status(500).json({
    error: 'An unexpected error occurred while generating the report',
    code: 'INTERNAL_ERROR',
  });
}

/**
 * Get list of available reports for the current user's role
 */
exports.getAvailableReportTypes = async (req, res) => {
  try {
    const context = buildContextFromRequest(req);
    const availableReports = getAvailableReports(context.userRole);

    res.json({ reports: availableReports });
  } catch (error) {
    handleReportError(error, res);
  }
};

/**
 * Portfolio Overview Report
 * GET /api/reports/overview
 */
exports.getPortfolioOverview = createReportHandler('portfolio');

/**
 * Occupancy Report
 * GET /api/reports/occupancy
 */
exports.getOccupancyReport = createReportHandler('occupancy');

/**
 * Financial Report
 * GET /api/reports/financial
 */
exports.getFinancialReport = createReportHandler('financial');

/**
 * Arrears Report
 * GET /api/reports/arrears
 */
exports.getArrearsReport = createReportHandler('arrears');

/**
 * Upcoming Tenancy Endings Report
 * GET /api/reports/upcoming-endings
 */
exports.getUpcomingEndings = createReportHandler('upcoming_endings');

// ============================================
// CSV Export Handlers
// ============================================

/**
 * Factory to create CSV export endpoint handlers
 */
function createExportHandler(reportType, exportType = null) {
  return async (req, res) => {
    try {
      const context = buildContextFromRequest(req);
      const filters = parseFiltersFromQuery(req.query);
      const options = parseOptionsFromQuery(req.query);

      // Generate the report
      const report = createAndGenerate(reportType, context, filters, options);

      // Determine export type (for financial report variants)
      const effectiveExportType = exportType || reportType;

      // Export to CSV
      const { csv, filename } = exportToCSV(effectiveExportType, report, options);

      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      handleReportError(error, res);
    }
  };
}

/**
 * Export Portfolio Overview to CSV
 * GET /api/reports/overview/export
 */
exports.exportPortfolioOverview = createExportHandler('portfolio');

/**
 * Export Occupancy Report to CSV
 * GET /api/reports/occupancy/export
 */
exports.exportOccupancyReport = createExportHandler('occupancy');

/**
 * Export Financial Report to CSV (monthly breakdown)
 * GET /api/reports/financial/export
 */
exports.exportFinancialReport = createExportHandler('financial');

/**
 * Export Financial Report to CSV (by property)
 * GET /api/reports/financial/export-by-property
 */
exports.exportFinancialByProperty = createExportHandler('financial', 'financial_by_property');

/**
 * Export Arrears Report to CSV
 * GET /api/reports/arrears/export
 */
exports.exportArrearsReport = createExportHandler('arrears');

/**
 * Export Upcoming Endings to CSV
 * GET /api/reports/upcoming-endings/export
 */
exports.exportUpcomingEndings = createExportHandler('upcoming_endings');

/**
 * Get available export formats for a report type
 * GET /api/reports/:type/export-formats
 */
exports.getExportFormatsForType = async (req, res) => {
  try {
    const { type } = req.params;
    const formats = getExportFormats(type);
    res.json({ formats });
  } catch (error) {
    handleReportError(error, res);
  }
};
