/**
 * Report Registry
 *
 * Central configuration for all report types.
 * Defines security settings, allowed roles, and default options.
 *
 * SECURITY NOTES:
 * - allowedRoles defines who can access each report type
 * - requiresLandlordForLandlord ensures landlord users cannot bypass data isolation
 * - The validation layer enforces these rules before any query is executed
 */

/**
 * Report configuration definitions
 */
const REPORT_CONFIGS = {
  portfolio: {
    name: 'Portfolio Overview',
    description: 'Summary of properties, rooms, and occupancy statistics',
    requiredFilters: [],
    defaultFilters: {},
    defaultOptions: {
      includeRoomDetails: true,
      includeLandlordInfo: false, // Auto-set true for admin viewing all
    },
    allowedRoles: ['admin', 'landlord'],
    // Security: Landlord users must have landlordId filter applied
    requiresLandlordForLandlord: true,
  },

  occupancy: {
    name: 'Occupancy Report',
    description: 'Detailed occupancy by property with current and next tenant information',
    requiredFilters: [],
    defaultFilters: {
      tenancyStatus: 'active',
    },
    defaultOptions: {
      includeNextTenant: true,
      includeRoomDetails: true,
      includeLandlordInfo: false,
    },
    allowedRoles: ['admin', 'landlord'],
    requiresLandlordForLandlord: true,
  },

  financial: {
    name: 'Financial Report',
    description: 'Payment collection and financial summary with monthly breakdown',
    requiredFilters: [],
    defaultFilters: {},
    defaultOptions: {
      includeFinancialBreakdown: true,
      includePaymentDetails: true,
      groupByProperty: true,
      includeLandlordInfo: false,
    },
    allowedRoles: ['admin', 'landlord'],
    requiresLandlordForLandlord: true,
  },

  arrears: {
    name: 'Arrears Report',
    description: 'Tenants with overdue payments and outstanding amounts',
    requiredFilters: [],
    defaultFilters: {
      paymentStatus: 'overdue',
    },
    defaultOptions: {
      includePaymentDetails: true,
      includeLandlordInfo: false,
    },
    allowedRoles: ['admin', 'landlord'],
    requiresLandlordForLandlord: true,
  },

  upcoming_endings: {
    name: 'Upcoming Tenancy Endings',
    description: 'Tenancies ending within a specified time period',
    requiredFilters: [],
    defaultFilters: {
      daysAhead: 90,
      tenancyStatus: 'active',
    },
    defaultOptions: {
      includeLandlordInfo: false,
    },
    allowedRoles: ['admin', 'landlord'],
    requiresLandlordForLandlord: true,
  },
};

/**
 * Get report configuration by type
 * @param {string} reportType - Report type key
 * @returns {Object|null} Report configuration or null if not found
 */
function getReportConfig(reportType) {
  return REPORT_CONFIGS[reportType] || null;
}

/**
 * Check if a role is allowed to access a report type
 * @param {string} reportType - Report type key
 * @param {string} role - User role
 * @returns {boolean} Whether access is allowed
 */
function isRoleAllowed(reportType, role) {
  const config = getReportConfig(reportType);
  if (!config) return false;
  return config.allowedRoles.includes(role);
}

/**
 * Get all available report types for a role
 * @param {string} role - User role
 * @returns {string[]} Array of allowed report type keys
 */
function getAvailableReports(role) {
  return Object.entries(REPORT_CONFIGS)
    .filter(([, config]) => config.allowedRoles.includes(role))
    .map(([key]) => key);
}

module.exports = {
  REPORT_CONFIGS,
  getReportConfig,
  isRoleAllowed,
  getAvailableReports,
};
