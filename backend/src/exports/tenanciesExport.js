/**
 * Tenancies Export Module
 *
 * Exports tenancy data with property and tenant information.
 */

const db = require('../db');
const { formatDate, formatCurrency } = require('../utils/csvGenerator');

// CSV column definitions
const columns = [
  { key: 'id', label: 'ID' },
  { key: 'property_address', label: 'Property Address' },
  { key: 'property_postcode', label: 'Postcode' },
  { key: 'tenancy_type', label: 'Tenancy Type' },
  { key: 'status', label: 'Status' },
  { key: 'start_date', label: 'Start Date', transform: formatDate },
  { key: 'end_date', label: 'End Date', transform: formatDate },
  { key: 'is_rolling_monthly', label: 'Rolling Monthly', transform: (v) => v ? 'Yes' : 'No' },
  { key: 'rent_amount', label: 'Rent Amount', transform: formatCurrency },
  { key: 'rent_frequency', label: 'Rent Frequency' },
  { key: 'deposit_amount', label: 'Deposit', transform: formatCurrency },
  { key: 'tenant_names', label: 'Tenant Names' },
  { key: 'tenant_count', label: 'Tenant Count' },
  { key: 'landlord_name', label: 'Landlord' },
  { key: 'auto_generate_payments', label: 'Auto Payments', transform: (v) => v ? 'Yes' : 'No' },
  { key: 'created_at', label: 'Created', transform: formatDate },
];

// XML schema definition
const xmlSchema = {
  rootElement: 'tenancies',
  rowElement: 'tenancy',
  fields: [
    { key: 'id', xmlName: 'id' },
    { key: 'property_address', xmlName: 'propertyAddress' },
    { key: 'property_postcode', xmlName: 'propertyPostcode' },
    { key: 'tenancy_type', xmlName: 'tenancyType' },
    { key: 'status', xmlName: 'status' },
    { key: 'start_date', xmlName: 'startDate', transform: formatDate },
    { key: 'end_date', xmlName: 'endDate', transform: formatDate },
    { key: 'is_rolling_monthly', xmlName: 'isRollingMonthly', transform: (v) => v ? 'true' : 'false' },
    { key: 'rent_amount', xmlName: 'rentAmount', transform: formatCurrency },
    { key: 'rent_frequency', xmlName: 'rentFrequency' },
    { key: 'deposit_amount', xmlName: 'depositAmount', transform: formatCurrency },
    { key: 'tenant_names', xmlName: 'tenantNames' },
    { key: 'tenant_count', xmlName: 'tenantCount' },
    { key: 'landlord_name', xmlName: 'landlordName' },
    { key: 'auto_generate_payments', xmlName: 'autoGeneratePayments', transform: (v) => v ? 'true' : 'false' },
    { key: 'created_at', xmlName: 'createdAt', transform: formatDate },
  ],
};

/**
 * Fetch tenancies data with optional filtering
 * @param {number} agencyId - Agency ID
 * @param {object} filters - Filter options
 * @param {boolean} includeRelated - Include related data (property, tenants, landlord)
 * @returns {Promise<Array>} - Tenancies data
 */
const fetchData = async (agencyId, filters = {}, includeRelated = true) => {
  let query = `
    SELECT
      t.id,
      t.tenancy_type,
      t.status,
      t.start_date,
      t.end_date,
      t.is_rolling_monthly,
      t.rent_amount,
      t.rent_frequency,
      t.deposit_amount,
      t.auto_generate_payments,
      t.created_at
      ${includeRelated ? `,
      COALESCE(p.address_line1, '') || ', ' || COALESCE(p.city, '') as property_address,
      p.postcode as property_postcode,
      l.name as landlord_name,
      (
        SELECT STRING_AGG(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, ''), ', ')
        FROM tenancy_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.tenancy_id = t.id
      ) as tenant_names,
      (
        SELECT COUNT(*)
        FROM tenancy_members tm
        WHERE tm.tenancy_id = t.id
      ) as tenant_count
      ` : ''}
    FROM tenancies t
    ${includeRelated ? `
    LEFT JOIN properties p ON t.property_id = p.id
    LEFT JOIN landlords l ON p.landlord_id = l.id
    ` : ''}
    WHERE t.agency_id = $1
  `;

  const params = [agencyId];
  let paramIndex = 2;

  // Apply filters
  if (filters.status) {
    query += ` AND t.status = $${paramIndex++}`;
    params.push(filters.status);
  }

  if (filters.tenancy_type) {
    query += ` AND t.tenancy_type = $${paramIndex++}`;
    params.push(filters.tenancy_type);
  }

  if (filters.property_id) {
    query += ` AND t.property_id = $${paramIndex++}`;
    params.push(filters.property_id);
  }

  if (filters.start_date_from) {
    query += ` AND t.start_date >= $${paramIndex++}`;
    params.push(filters.start_date_from);
  }

  if (filters.start_date_to) {
    query += ` AND t.start_date <= $${paramIndex++}`;
    params.push(filters.start_date_to);
  }

  if (filters.end_date_from) {
    query += ` AND t.end_date >= $${paramIndex++}`;
    params.push(filters.end_date_from);
  }

  if (filters.end_date_to) {
    query += ` AND t.end_date <= $${paramIndex++}`;
    params.push(filters.end_date_to);
  }

  query += ' ORDER BY t.id ASC';

  const result = await db.query(query, params, agencyId);
  return result.rows;
};

module.exports = {
  columns,
  xmlSchema,
  fetchData,
};
