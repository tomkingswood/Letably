/**
 * Report Generation Framework - Main Entry Point
 *
 * Provides unified report generation with role-based security,
 * automatic landlord filtering, and validation.
 *
 * SECURITY ARCHITECTURE:
 * - Landlord users are FORCED to filter by their own landlordId
 * - Admin users can view all data or filter by specific landlord
 * - All queries use parameterized values to prevent SQL injection
 * - Report access is restricted by allowedRoles in registry
 */

const generators = require('./generators');
const { getReportConfig, isRoleAllowed, getAvailableReports } = require('./reportRegistry');

/**
 * Report generation error types
 */
class ReportError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ReportError';
    this.code = code;
  }
}

/**
 * Create a validated report request object
 *
 * @param {string} reportType - Type of report (portfolio, occupancy, etc.)
 * @param {Object} context - User context
 * @param {string} context.userRole - User role (admin or landlord)
 * @param {number} context.userId - User ID
 * @param {number|null} context.landlordId - Landlord ID (required for landlord users)
 * @param {Object} filters - Request filters
 * @param {Object} options - Report options
 * @returns {Object} Validated report request
 * @throws {ReportError} If validation fails
 */
function createReportRequest(reportType, context, filters = {}, options = {}) {
  // Validate report type exists
  const config = getReportConfig(reportType);
  if (!config) {
    throw new ReportError(`Unknown report type: ${reportType}`, 'INVALID_REPORT_TYPE');
  }

  // Validate role access
  if (!isRoleAllowed(reportType, context.userRole)) {
    throw new ReportError(
      `Role '${context.userRole}' is not allowed to access '${reportType}' reports`,
      'ACCESS_DENIED'
    );
  }

  // SECURITY: Force landlord filter for landlord users
  const effectiveFilters = { ...config.defaultFilters, ...filters };
  if (context.userRole === 'landlord') {
    if (!context.landlordId) {
      throw new ReportError(
        'Landlord users must have a landlordId in context',
        'MISSING_LANDLORD_ID'
      );
    }
    // Force the landlord filter - cannot be overridden
    effectiveFilters.landlordId = context.landlordId;
  }

  // Determine effective options
  const effectiveOptions = { ...config.defaultOptions, ...options };

  // Auto-enable landlord info for admin viewing all
  if (context.userRole === 'admin' && !effectiveFilters.landlordId) {
    effectiveOptions.includeLandlordInfo = true;
  }

  // Require agencyId for multi-tenancy isolation
  if (!context.agencyId) {
    throw new ReportError('Agency ID is required in context', 'MISSING_AGENCY_ID');
  }

  return {
    reportType,
    context: {
      userRole: context.userRole,
      userId: context.userId,
      landlordId: context.landlordId || null,
      agencyId: context.agencyId,
    },
    filters: effectiveFilters,
    options: effectiveOptions,
    config,
  };
}

/**
 * Generate a report
 *
 * @param {Object} request - Report request (from createReportRequest)
 * @returns {Promise<Object>} Generated report data
 * @throws {ReportError} If generation fails
 */
async function generateReport(request) {
  const { reportType } = request;

  const generator = generators[reportType];
  if (!generator) {
    throw new ReportError(
      `No generator found for report type: ${reportType}`,
      'NO_GENERATOR'
    );
  }

  try {
    const agencyId = request.context?.agencyId;
    return await generator.generate(request, agencyId);
  } catch (error) {
    // Re-throw ReportErrors as-is
    if (error instanceof ReportError) {
      throw error;
    }
    // Wrap other errors
    throw new ReportError(
      `Failed to generate ${reportType} report: ${error.message}`,
      'GENERATION_FAILED'
    );
  }
}

/**
 * Convenience function to create request and generate in one call
 *
 * @param {string} reportType - Type of report
 * @param {Object} context - User context
 * @param {Object} filters - Request filters
 * @param {Object} options - Report options
 * @returns {Promise<Object>} Generated report data
 */
function createAndGenerate(reportType, context, filters = {}, options = {}) {
  const request = createReportRequest(reportType, context, filters, options);
  return generateReport(request);
}

/**
 * Build context object from Express request
 * Extracts user role and landlordId from authenticated user
 *
 * @param {Object} req - Express request with req.user
 * @returns {Object} Context object for report generation
 */
function buildContextFromRequest(req) {
  const user = req.user;
  if (!user) {
    throw new ReportError('Authentication required', 'NOT_AUTHENTICATED');
  }

  return {
    userRole: user.role,
    userId: user.id,
    landlordId: user.landlordId || null,
    agencyId: req.agencyId,
  };
}

/**
 * Parse filters from query parameters
 *
 * @param {Object} query - Express request query params
 * @returns {Object} Parsed filters
 */
function parseFiltersFromQuery(query) {
  const filters = {};

  // landlordId - admin can specify, landlord will be overwritten anyway
  if (query.landlord_id) {
    filters.landlordId = parseInt(query.landlord_id, 10);
  }

  // propertyId
  if (query.property_id) {
    filters.propertyId = parseInt(query.property_id, 10);
  }

  // Year/month for financial reports
  if (query.year) {
    filters.year = parseInt(query.year, 10);
  }
  if (query.month) {
    filters.month = parseInt(query.month, 10);
  }

  // Days ahead for upcoming endings
  if (query.days || query.days_ahead) {
    filters.daysAhead = parseInt(query.days || query.days_ahead, 10);
  }

  // Tenancy status filter
  if (query.tenancy_status) {
    filters.tenancyStatus = query.tenancy_status;
  }

  // Payment status filter
  if (query.payment_status) {
    filters.paymentStatus = query.payment_status;
  }

  return filters;
}

/**
 * Parse options from query parameters
 *
 * @param {Object} query - Express request query params
 * @returns {Object} Parsed options
 */
function parseOptionsFromQuery(query) {
  const options = {};

  // Boolean options (check for 'true' string or truthy value)
  if (query.include_next_tenant !== undefined) {
    options.includeNextTenant = query.include_next_tenant === 'true' || query.include_next_tenant === true;
  }
  if (query.include_room_details !== undefined) {
    options.includeRoomDetails = query.include_room_details === 'true' || query.include_room_details === true;
  }
  if (query.include_landlord_info !== undefined) {
    options.includeLandlordInfo = query.include_landlord_info === 'true' || query.include_landlord_info === true;
  }
  if (query.group_by_property !== undefined) {
    options.groupByProperty = query.group_by_property === 'true' || query.group_by_property === true;
  }

  return options;
}

module.exports = {
  // Main API
  createReportRequest,
  generateReport,
  createAndGenerate,

  // Helpers for Express handlers
  buildContextFromRequest,
  parseFiltersFromQuery,
  parseOptionsFromQuery,

  // Registry access
  getReportConfig,
  isRoleAllowed,
  getAvailableReports,

  // Error class
  ReportError,
};
