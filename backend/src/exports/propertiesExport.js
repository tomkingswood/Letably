/**
 * Properties Export Module
 *
 * Exports property data with optional landlord information.
 */

const db = require('../db');
const { formatDate, formatCurrency } = require('../utils/csvGenerator');

// CSV column definitions
const columns = [
  { key: 'id', label: 'ID' },
  { key: 'title', label: 'Title' },
  { key: 'address_line1', label: 'Address Line 1' },
  { key: 'address_line2', label: 'Address Line 2' },
  { key: 'city', label: 'City' },
  { key: 'postcode', label: 'Postcode' },
  { key: 'property_type', label: 'Property Type' },
  { key: 'letting_type', label: 'Letting Type' },
  { key: 'bedroom_count', label: 'Bedrooms' },
  { key: 'bathrooms', label: 'Bathrooms' },
  { key: 'is_live', label: 'Live', transform: (v) => v ? 'Yes' : 'No' },
  { key: 'has_parking', label: 'Parking', transform: (v) => v ? 'Yes' : 'No' },
  { key: 'has_garden', label: 'Garden', transform: (v) => v ? 'Yes' : 'No' },
  { key: 'bills_included', label: 'Bills Included', transform: (v) => v ? 'Yes' : 'No' },
  { key: 'available_from', label: 'Available From', transform: formatDate },
  { key: 'landlord_name', label: 'Landlord Name' },
  { key: 'landlord_email', label: 'Landlord Email' },
  { key: 'location_name', label: 'Location' },
  { key: 'created_at', label: 'Created', transform: formatDate },
  { key: 'updated_at', label: 'Updated', transform: formatDate },
];

// XML schema definition
const xmlSchema = {
  rootElement: 'properties',
  rowElement: 'property',
  fields: [
    { key: 'id', xmlName: 'id' },
    { key: 'title', xmlName: 'title' },
    { key: 'address_line1', xmlName: 'addressLine1' },
    { key: 'address_line2', xmlName: 'addressLine2' },
    { key: 'city', xmlName: 'city' },
    { key: 'postcode', xmlName: 'postcode' },
    { key: 'property_type', xmlName: 'propertyType' },
    { key: 'letting_type', xmlName: 'lettingType' },
    { key: 'bedroom_count', xmlName: 'bedrooms' },
    { key: 'bathrooms', xmlName: 'bathrooms' },
    { key: 'is_live', xmlName: 'isLive', transform: (v) => v ? 'true' : 'false' },
    { key: 'has_parking', xmlName: 'hasParking', transform: (v) => v ? 'true' : 'false' },
    { key: 'has_garden', xmlName: 'hasGarden', transform: (v) => v ? 'true' : 'false' },
    { key: 'bills_included', xmlName: 'billsIncluded', transform: (v) => v ? 'true' : 'false' },
    { key: 'available_from', xmlName: 'availableFrom', transform: formatDate },
    { key: 'landlord_name', xmlName: 'landlordName' },
    { key: 'landlord_email', xmlName: 'landlordEmail' },
    { key: 'location_name', xmlName: 'locationName' },
    { key: 'created_at', xmlName: 'createdAt', transform: formatDate },
    { key: 'updated_at', xmlName: 'updatedAt', transform: formatDate },
  ],
};

/**
 * Fetch properties data with optional filtering
 * @param {number} agencyId - Agency ID
 * @param {object} filters - Filter options
 * @param {boolean} includeRelated - Include related data (landlord, location)
 * @returns {Promise<Array>} - Properties data
 */
const fetchData = async (agencyId, filters = {}, includeRelated = true) => {
  let query = `
    SELECT
      p.id,
      p.title,
      p.address_line1,
      p.address_line2,
      p.city,
      p.postcode,
      p.property_type,
      p.letting_type,
      (SELECT COUNT(*) FROM bedrooms WHERE property_id = p.id) as bedroom_count,
      p.bathrooms,
      p.is_live,
      p.has_parking,
      p.has_garden,
      p.bills_included,
      p.available_from,
      p.created_at,
      p.updated_at
      ${includeRelated ? `, l.name as landlord_name, l.email as landlord_email, p.location as location_name` : ''}
    FROM properties p
    ${includeRelated ? `LEFT JOIN landlords l ON p.landlord_id = l.id` : ''}
    WHERE p.agency_id = $1
  `;

  const params = [agencyId];
  let paramIndex = 2;

  // Apply filters
  if (filters.is_live !== undefined && filters.is_live !== '') {
    query += ` AND p.is_live = $${paramIndex++}`;
    params.push(filters.is_live === 'true' || filters.is_live === true);
  }

  if (filters.landlord_id) {
    query += ` AND p.landlord_id = $${paramIndex++}`;
    params.push(filters.landlord_id);
  }

  if (filters.location) {
    query += ` AND p.location = $${paramIndex++}`;
    params.push(filters.location);
  }

  query += ' ORDER BY p.id ASC';

  const result = await db.query(query, params, agencyId);
  return result.rows;
};

module.exports = {
  columns,
  xmlSchema,
  fetchData,
};
