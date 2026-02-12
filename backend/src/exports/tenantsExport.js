/**
 * Tenants Export Module
 *
 * Exports tenant (tenancy member) data with user and tenancy information.
 */

const db = require('../db');
const { formatDate, formatCurrency } = require('../utils/csvGenerator');

// CSV column definitions
const columns = [
  { key: 'id', label: 'Member ID' },
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'bedroom_name', label: 'Room' },
  { key: 'rent_pppw', label: 'Rent (PPPW)', transform: formatCurrency },
  { key: 'deposit_amount', label: 'Deposit', transform: formatCurrency },
  { key: 'is_signed', label: 'Signed', transform: (v) => v ? 'Yes' : 'No' },
  { key: 'signed_at', label: 'Signed Date', transform: formatDate },
  { key: 'payment_option', label: 'Payment Option' },
  { key: 'property_address', label: 'Property Address' },
  { key: 'property_postcode', label: 'Postcode' },
  { key: 'tenancy_status', label: 'Tenancy Status' },
  { key: 'tenancy_start', label: 'Tenancy Start', transform: formatDate },
  { key: 'tenancy_end', label: 'Tenancy End', transform: formatDate },
  { key: 'guarantor_required', label: 'Guarantor Required', transform: (v) => v ? 'Yes' : 'No' },
  { key: 'guarantor_name', label: 'Guarantor Name' },
  { key: 'created_at', label: 'Created', transform: formatDate },
];

// XML schema definition
const xmlSchema = {
  rootElement: 'tenants',
  rowElement: 'tenant',
  fields: [
    { key: 'id', xmlName: 'memberId' },
    { key: 'first_name', xmlName: 'firstName' },
    { key: 'last_name', xmlName: 'lastName' },
    { key: 'email', xmlName: 'email' },
    { key: 'phone', xmlName: 'phone' },
    { key: 'bedroom_name', xmlName: 'roomName' },
    { key: 'rent_pppw', xmlName: 'rentPppw', transform: formatCurrency },
    { key: 'deposit_amount', xmlName: 'depositAmount', transform: formatCurrency },
    { key: 'is_signed', xmlName: 'isSigned', transform: (v) => v ? 'true' : 'false' },
    { key: 'signed_at', xmlName: 'signedAt', transform: formatDate },
    { key: 'payment_option', xmlName: 'paymentOption' },
    { key: 'property_address', xmlName: 'propertyAddress' },
    { key: 'property_postcode', xmlName: 'propertyPostcode' },
    { key: 'tenancy_status', xmlName: 'tenancyStatus' },
    { key: 'tenancy_start', xmlName: 'tenancyStart', transform: formatDate },
    { key: 'tenancy_end', xmlName: 'tenancyEnd', transform: formatDate },
    { key: 'guarantor_required', xmlName: 'guarantorRequired', transform: (v) => v ? 'true' : 'false' },
    { key: 'guarantor_name', xmlName: 'guarantorName' },
    { key: 'created_at', xmlName: 'createdAt', transform: formatDate },
  ],
};

/**
 * Fetch tenants (tenancy members) data with optional filtering
 * @param {number} agencyId - Agency ID
 * @param {object} filters - Filter options
 * @param {boolean} includeRelated - Include related data (user, property, tenancy)
 * @returns {Promise<Array>} - Tenants data
 */
const fetchData = async (agencyId, filters = {}, includeRelated = true) => {
  let query = `
    SELECT
      tm.id,
      tm.is_signed,
      tm.signed_at,
      tm.payment_option,
      tm.guarantor_required,
      tm.guarantor_name,
      tm.rent_pppw,
      tm.deposit_amount,
      tm.created_at
      ${includeRelated ? `,
      u.first_name,
      u.last_name,
      u.email,
      u.phone,
      b.bedroom_name,
      COALESCE(p.address_line1, '') || ', ' || COALESCE(p.city, '') as property_address,
      p.postcode as property_postcode,
      ten.status as tenancy_status,
      ten.start_date as tenancy_start,
      ten.end_date as tenancy_end
      ` : ''}
    FROM tenancy_members tm
    ${includeRelated ? `
    LEFT JOIN users u ON tm.user_id = u.id
    LEFT JOIN bedrooms b ON tm.bedroom_id = b.id
    LEFT JOIN tenancies ten ON tm.tenancy_id = ten.id
    LEFT JOIN properties p ON ten.property_id = p.id
    ` : ''}
    WHERE tm.agency_id = $1
  `;

  const params = [agencyId];
  let paramIndex = 2;

  // Apply filters
  if (filters.tenancy_status) {
    query += ` AND ten.status = $${paramIndex++}`;
    params.push(filters.tenancy_status);
  }

  if (filters.property_id) {
    query += ` AND ten.property_id = $${paramIndex++}`;
    params.push(filters.property_id);
  }

  if (filters.has_signed !== undefined && filters.has_signed !== '') {
    query += ` AND tm.is_signed = $${paramIndex++}`;
    params.push(filters.has_signed === 'true' || filters.has_signed === true);
  }

  query += ' ORDER BY tm.id ASC';

  const result = await db.query(query, params, agencyId);
  return result.rows;
};

module.exports = {
  columns,
  xmlSchema,
  fetchData,
};
