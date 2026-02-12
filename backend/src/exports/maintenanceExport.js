/**
 * Maintenance Requests Export Module
 *
 * Exports maintenance request data with property and reporter information.
 */

const db = require('../db');
const { formatDate } = require('../utils/csvGenerator');

// CSV column definitions
const columns = [
  { key: 'id', label: 'ID' },
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'reporter_name', label: 'Reporter Name' },
  { key: 'reporter_email', label: 'Reporter Email' },
  { key: 'property_address', label: 'Property' },
  { key: 'property_postcode', label: 'Postcode' },
  { key: 'landlord_name', label: 'Landlord' },
  { key: 'resolved_at', label: 'Resolved At', transform: formatDate },
  { key: 'resolution_notes', label: 'Resolution Notes' },
  { key: 'created_at', label: 'Created', transform: formatDate },
  { key: 'updated_at', label: 'Updated', transform: formatDate },
];

// XML schema definition
const xmlSchema = {
  rootElement: 'maintenanceRequests',
  rowElement: 'maintenanceRequest',
  fields: [
    { key: 'id', xmlName: 'id' },
    { key: 'title', xmlName: 'title' },
    { key: 'description', xmlName: 'description' },
    { key: 'category', xmlName: 'category' },
    { key: 'priority', xmlName: 'priority' },
    { key: 'status', xmlName: 'status' },
    { key: 'reporter_name', xmlName: 'reporterName' },
    { key: 'reporter_email', xmlName: 'reporterEmail' },
    { key: 'property_address', xmlName: 'propertyAddress' },
    { key: 'property_postcode', xmlName: 'propertyPostcode' },
    { key: 'landlord_name', xmlName: 'landlordName' },
    { key: 'resolved_at', xmlName: 'resolvedAt', transform: formatDate },
    { key: 'resolution_notes', xmlName: 'resolutionNotes' },
    { key: 'created_at', xmlName: 'createdAt', transform: formatDate },
    { key: 'updated_at', xmlName: 'updatedAt', transform: formatDate },
  ],
};

/**
 * Fetch maintenance requests data with optional filtering
 * @param {number} agencyId - Agency ID
 * @param {object} filters - Filter options
 * @param {boolean} includeRelated - Include related data (property, reporter, landlord)
 * @returns {Promise<Array>} - Maintenance requests data
 */
const fetchData = async (agencyId, filters = {}, includeRelated = true) => {
  let query = `
    SELECT
      m.id,
      m.title,
      m.description,
      m.category,
      m.priority,
      m.status,
      m.resolved_at,
      m.resolution_notes,
      m.created_at,
      m.updated_at
      ${includeRelated ? `,
      COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '') as reporter_name,
      u.email as reporter_email,
      COALESCE(p.address_line1, '') || ', ' || COALESCE(p.city, '') as property_address,
      p.postcode as property_postcode,
      l.name as landlord_name
      ` : ''}
    FROM maintenance_requests m
    ${includeRelated ? `
    LEFT JOIN users u ON m.created_by_user_id = u.id
    LEFT JOIN tenancies t ON m.tenancy_id = t.id
    LEFT JOIN properties p ON t.property_id = p.id
    LEFT JOIN landlords l ON p.landlord_id = l.id
    ` : ''}
    WHERE m.agency_id = $1
  `;

  const params = [agencyId];
  let paramIndex = 2;

  // Apply filters
  if (filters.status) {
    query += ` AND m.status = $${paramIndex++}`;
    params.push(filters.status);
  }

  if (filters.priority) {
    query += ` AND m.priority = $${paramIndex++}`;
    params.push(filters.priority);
  }

  if (filters.category) {
    query += ` AND m.category = $${paramIndex++}`;
    params.push(filters.category);
  }

  if (filters.created_from) {
    query += ` AND m.created_at >= $${paramIndex++}`;
    params.push(filters.created_from);
  }

  if (filters.created_to) {
    query += ` AND m.created_at <= $${paramIndex++}`;
    params.push(filters.created_to);
  }

  query += ' ORDER BY m.created_at DESC, m.id ASC';

  const result = await db.query(query, params, agencyId);
  return result.rows;
};

module.exports = {
  columns,
  xmlSchema,
  fetchData,
};
