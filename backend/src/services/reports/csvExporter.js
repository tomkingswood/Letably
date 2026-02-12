/**
 * CSV Export Utility
 *
 * Converts report data to CSV format for download.
 * Handles nested structures by flattening appropriately per report type.
 */

const { formatDate: formatDateUtil } = require('../../utils/dateFormatter');

/**
 * Escape a value for CSV (handle commas, quotes, newlines)
 */
function escapeCSV(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If contains comma, quote, or newline, wrap in quotes and escape existing quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Convert array of objects to CSV string
 */
function arrayToCSV(data, columns) {
  if (!data || data.length === 0) {
    return columns.map(c => c.header).join(',') + '\n';
  }

  // Header row
  const header = columns.map(c => escapeCSV(c.header)).join(',');

  // Data rows
  const rows = data.map(row => {
    return columns.map(c => {
      const value = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
      return escapeCSV(value);
    }).join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Format date for display - uses centralized dateFormatter
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  return formatDateUtil(dateStr, 'short') || '';
}

/**
 * Format currency
 */
function formatCurrency(value) {
  if (value === null || value === undefined) return '';
  return `£${Number(value).toFixed(2)}`;
}

/**
 * Export configurations for each report type
 */
const exportConfigs = {
  /**
   * Portfolio Overview - Room-level export
   */
  portfolio: {
    filename: 'portfolio-overview',
    transform: (report, options = {}) => {
      const bedrooms = report.bedroomDetails || [];
      const columns = [
        { header: 'Property', accessor: 'address_line1' },
        { header: 'Bedroom', accessor: 'bedroom_name' },
        { header: 'Status', accessor: row => row.is_occupied ? 'Occupied' : 'Vacant' },
        { header: 'Tenant', accessor: 'tenant_name' },
        { header: 'Tenancy End', accessor: row => formatDate(row.tenancy_end_date) },
      ];

      // Add landlord column for admin viewing all
      if (options.includeLandlordInfo && bedrooms.length > 0 && bedrooms[0].landlord_name !== undefined) {
        columns.unshift({ header: 'Landlord', accessor: 'landlord_name' });
      }

      return { data: bedrooms, columns };
    },
  },

  /**
   * Occupancy Report - Room-level with tenant details
   */
  occupancy: {
    filename: 'occupancy-report',
    transform: (report, options = {}) => {
      // Flatten properties -> rooms
      const rows = [];

      for (const property of report.properties || []) {
        // Handle whole house tenancy
        if (property.wholeHouseTenancy) {
          rows.push({
            landlord_name: property.landlord_name,
            property_address: property.address,
            bedroom_name: 'Whole House',
            base_rent: '',
            status: 'Occupied',
            tenant_name: property.wholeHouseTenancy.tenants,
            tenant_rent: formatCurrency(property.wholeHouseTenancy.totalRent),
            tenancy_start: formatDate(property.wholeHouseTenancy.startDate),
            tenancy_end: formatDate(property.wholeHouseTenancy.endDate),
            next_tenant: property.nextWholeHouseTenancy?.tenants || '',
            next_start: property.nextWholeHouseTenancy ? formatDate(property.nextWholeHouseTenancy.startDate) : '',
            next_end: property.nextWholeHouseTenancy ? formatDate(property.nextWholeHouseTenancy.endDate) : '',
          });
        } else {
          // Individual rooms
          for (const room of property.bedrooms || []) {
            rows.push({
              landlord_name: property.landlord_name,
              property_address: property.address,
              bedroom_name: room.name,
              base_rent: formatCurrency(room.baseRent),
              status: room.isOccupied ? 'Occupied' : 'Vacant',
              tenant_name: room.tenant?.name || '',
              tenant_rent: room.tenant ? formatCurrency(room.tenant.rentPPPW) : '',
              tenancy_start: room.tenant ? formatDate(room.tenant.tenancyStart) : '',
              tenancy_end: room.tenant ? formatDate(room.tenant.tenancyEnd) : '',
              next_tenant: room.nextTenant?.name || '',
              next_start: room.nextTenant ? formatDate(room.nextTenant.tenancyStart) : '',
              next_end: room.nextTenant ? formatDate(room.nextTenant.tenancyEnd) : '',
            });
          }
        }
      }

      const columns = [
        { header: 'Property', accessor: 'property_address' },
        { header: 'Room', accessor: 'bedroom_name' },
        { header: 'Base Rent (PPPW)', accessor: 'base_rent' },
        { header: 'Status', accessor: 'status' },
        { header: 'Current Tenant', accessor: 'tenant_name' },
        { header: 'Current Rent (PPPW)', accessor: 'tenant_rent' },
        { header: 'Start Date', accessor: 'tenancy_start' },
        { header: 'End Date', accessor: 'tenancy_end' },
        { header: 'Next Tenant', accessor: 'next_tenant' },
        { header: 'Next Start', accessor: 'next_start' },
        { header: 'Next End', accessor: 'next_end' },
      ];

      // Add landlord column for admin viewing all
      if (options.includeLandlordInfo && rows.length > 0 && rows[0].landlord_name !== undefined) {
        columns.unshift({ header: 'Landlord', accessor: 'landlord_name' });
      }

      return { data: rows, columns };
    },
  },

  /**
   * Financial Report - Monthly breakdown
   */
  financial: {
    filename: 'financial-report',
    transform: (report, options = {}) => {
      // Monthly data
      const monthlyColumns = [
        { header: 'Month', accessor: 'monthName' },
        { header: 'Total Due', accessor: row => formatCurrency(row.totalDue) },
        { header: 'Total Paid', accessor: row => formatCurrency(row.totalPaid) },
        { header: 'Outstanding', accessor: row => formatCurrency(row.outstanding) },
        { header: 'Payment Count', accessor: 'paymentCount' },
        { header: 'Paid Count', accessor: 'paidCount' },
        { header: 'Overdue Count', accessor: 'overdueCount' },
        { header: 'Collection Rate', accessor: row => `${row.collectionRate}%` },
      ];

      // Add annual totals as last row
      const data = [...(report.monthly || [])];
      if (report.annual) {
        data.push({
          monthName: 'ANNUAL TOTAL',
          totalDue: report.annual.totalDue,
          totalPaid: report.annual.totalPaid,
          outstanding: report.annual.outstanding,
          paymentCount: report.annual.paymentCount,
          paidCount: report.annual.paidCount,
          overdueCount: report.annual.overdueCount,
          collectionRate: report.annual.collectionRate,
        });
      }

      return { data, columns: monthlyColumns };
    },
  },

  /**
   * Financial Report - Property breakdown variant
   */
  financial_by_property: {
    filename: 'financial-by-property',
    transform: (report, options = {}) => {
      const columns = [
        { header: 'Property', accessor: 'address' },
        { header: 'Total Due', accessor: row => formatCurrency(row.total_due) },
        { header: 'Total Paid', accessor: row => formatCurrency(row.total_paid) },
        { header: 'Outstanding', accessor: row => formatCurrency(row.outstanding) },
        { header: 'Tenant Count', accessor: 'tenant_count' },
      ];

      // Add landlord column for admin viewing all
      if (options.includeLandlordInfo && report.byProperty?.length > 0 && report.byProperty[0].landlord_name !== undefined) {
        columns.unshift({ header: 'Landlord', accessor: 'landlord_name' });
      }

      return { data: report.byProperty || [], columns };
    },
  },

  /**
   * Arrears Report
   */
  arrears: {
    filename: 'arrears-report',
    transform: (report, options = {}) => {
      const columns = [
        { header: 'Tenant', accessor: 'tenant_name' },
        { header: 'Email', accessor: 'tenant_email' },
        { header: 'Phone', accessor: 'tenant_phone' },
        { header: 'Property', accessor: 'property_address' },
        { header: 'Room', accessor: 'bedroom_name' },
        { header: 'Overdue Payments', accessor: 'overdue_payments' },
        { header: 'Total Arrears', accessor: row => formatCurrency(row.total_arrears) },
        { header: 'Days Overdue', accessor: 'days_overdue' },
      ];

      // Add landlord column for admin viewing all
      if (options.includeLandlordInfo && report.tenants?.length > 0 && report.tenants[0].landlord_name !== undefined) {
        columns.unshift({ header: 'Landlord', accessor: 'landlord_name' });
      }

      return { data: report.tenants || [], columns };
    },
  },

  /**
   * Upcoming Endings Report
   */
  upcoming_endings: {
    filename: 'upcoming-endings',
    transform: (report, options = {}) => {
      const columns = [
        { header: 'Property', accessor: 'property_address' },
        { header: 'Tenants', accessor: 'tenants' },
        { header: 'Tenant Count', accessor: 'tenant_count' },
        { header: 'Weekly Rent', accessor: row => formatCurrency(row.total_weekly_rent) },
        { header: 'End Date', accessor: row => formatDate(row.end_date) },
        { header: 'Days Until End', accessor: 'days_until_end' },
        { header: 'Rolling Monthly', accessor: row => row.is_rolling_monthly ? 'Yes' : 'No' },
      ];

      // Add landlord column for admin viewing all
      if (options.includeLandlordInfo && report.tenancies?.length > 0 && report.tenancies[0].landlord_name !== undefined) {
        columns.unshift({ header: 'Landlord', accessor: 'landlord_name' });
      }

      return { data: report.tenancies || [], columns };
    },
  },
};

/**
 * Export report to CSV
 *
 * @param {string} reportType - Type of report
 * @param {Object} reportData - Generated report data
 * @param {Object} options - Export options
 * @returns {{ csv: string, filename: string }} CSV content and suggested filename
 */
function exportToCSV(reportType, reportData, options = {}) {
  const config = exportConfigs[reportType];
  if (!config) {
    throw new Error(`No export configuration for report type: ${reportType}`);
  }

  const { data, columns } = config.transform(reportData, options);
  const csvContent = arrayToCSV(data, columns);

  // Add UTF-8 BOM for Excel compatibility with £ symbol and other special characters
  const UTF8_BOM = '\uFEFF';
  const csv = UTF8_BOM + csvContent;

  // Generate filename with date
  const date = new Date().toISOString().split('T')[0];
  const filename = `${config.filename}-${date}.csv`;

  return { csv, filename };
}

/**
 * Get available export formats for a report type
 */
function getExportFormats(reportType) {
  const formats = ['csv'];

  // Financial has additional property breakdown export
  if (reportType === 'financial') {
    formats.push('csv_by_property');
  }

  return formats;
}

module.exports = {
  exportToCSV,
  getExportFormats,
  exportConfigs,
};
