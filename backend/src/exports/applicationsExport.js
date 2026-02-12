/**
 * Applications Export Module
 *
 * Exports application data with user and property information.
 */

const db = require('../db');
const { formatDate } = require('../utils/csvGenerator');

// CSV column definitions
const columns = [
  { key: 'id', label: 'ID' },
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'status', label: 'Status' },
  { key: 'application_type', label: 'Application Type' },
  { key: 'guarantor_required', label: 'Guarantor Required', transform: (v) => v ? 'Yes' : 'No' },
  { key: 'guarantor_name', label: 'Guarantor Name' },
  { key: 'guarantor_email', label: 'Guarantor Email' },
  { key: 'current_address', label: 'Current Address' },
  { key: 'created_at', label: 'Created', transform: formatDate },
  { key: 'updated_at', label: 'Updated', transform: formatDate },
];

// XML schema definition
const xmlSchema = {
  rootElement: 'applications',
  rowElement: 'application',
  fields: [
    { key: 'id', xmlName: 'id' },
    { key: 'first_name', xmlName: 'firstName' },
    { key: 'last_name', xmlName: 'lastName' },
    { key: 'email', xmlName: 'email' },
    { key: 'phone', xmlName: 'phone' },
    { key: 'status', xmlName: 'status' },
    { key: 'application_type', xmlName: 'applicationType' },
    { key: 'guarantor_required', xmlName: 'guarantorRequired', transform: (v) => v ? 'true' : 'false' },
    { key: 'guarantor_name', xmlName: 'guarantorName' },
    { key: 'guarantor_email', xmlName: 'guarantorEmail' },
    { key: 'current_address', xmlName: 'currentAddress' },
    { key: 'created_at', xmlName: 'createdAt', transform: formatDate },
    { key: 'updated_at', xmlName: 'updatedAt', transform: formatDate },
  ],
};

/**
 * Fetch applications data with optional filtering
 * @param {number} agencyId - Agency ID
 * @param {object} filters - Filter options
 * @param {boolean} includeRelated - Include related data (user, property)
 * @returns {Promise<Array>} - Applications data
 */
const fetchData = async (agencyId, filters = {}, includeRelated = true) => {
  let query = `
    SELECT
      a.id,
      a.status,
      a.application_type,
      a.guarantor_required,
      a.guarantor_name,
      a.guarantor_email,
      a.current_address,
      a.created_at,
      a.updated_at
      ${includeRelated ? `,
      COALESCE(a.first_name, u.first_name) as first_name,
      COALESCE(a.surname, u.last_name) as last_name,
      u.email,
      u.phone
      ` : ''}
    FROM applications a
    ${includeRelated ? `
    LEFT JOIN users u ON a.user_id = u.id
    ` : ''}
    WHERE a.agency_id = $1
  `;

  const params = [agencyId];
  let paramIndex = 2;

  // Apply filters
  if (filters.status) {
    query += ` AND a.status = $${paramIndex++}`;
    params.push(filters.status);
  }

  if (filters.application_type) {
    query += ` AND a.application_type = $${paramIndex++}`;
    params.push(filters.application_type);
  }

  if (filters.created_from) {
    query += ` AND a.created_at >= $${paramIndex++}`;
    params.push(filters.created_from);
  }

  if (filters.created_to) {
    query += ` AND a.created_at <= $${paramIndex++}`;
    params.push(filters.created_to);
  }

  query += ' ORDER BY a.id ASC';

  const result = await db.query(query, params, agencyId);
  return result.rows;
};

module.exports = {
  columns,
  xmlSchema,
  fetchData,
};
