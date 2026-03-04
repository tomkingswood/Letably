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
  { key: 'letting_type', label: 'Letting Type' },
  { key: 'bedroom_count', label: 'Bedrooms' },
  { key: 'is_live', label: 'Live', transform: (v) => v ? 'Yes' : 'No' },
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
    { key: 'letting_type', xmlName: 'lettingType' },
    { key: 'bedroom_count', xmlName: 'bedrooms' },
    { key: 'is_live', xmlName: 'isLive', transform: (v) => v ? 'true' : 'false' },
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
      CONCAT_WS(', ', p.address_line1, p.city, p.postcode) as title,
      p.address_line1,
      p.address_line2,
      p.city,
      p.postcode,
      p.letting_type,
      (SELECT COUNT(*) FROM bedrooms WHERE property_id = p.id AND agency_id = $1) as bedroom_count,
      p.is_live,
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

  // Request-scoped copy of columns to avoid mutating module-level array
  const exportColumns = [...columns];

  // Fetch custom attributes for export
  const propertyIds = result.rows.map(r => r.id);
  if (propertyIds.length > 0) {
    const attrsResult = await db.query(`
      SELECT pav.property_id, pad.name,
        COALESCE(
          pav.value_text,
          pav.value_number::text,
          CASE WHEN pav.value_boolean IS NULL THEN NULL WHEN pav.value_boolean THEN 'Yes' ELSE 'No' END
        ) as value
      FROM property_attribute_values pav
      JOIN property_attribute_definitions pad ON pad.id = pav.attribute_definition_id
      WHERE pav.property_id = ANY($1) AND pav.agency_id = $2
      ORDER BY pad.display_order ASC
    `, [propertyIds, agencyId], agencyId);

    // Group by property_id with namespaced keys
    const attrsByProperty = {};
    for (const row of attrsResult.rows) {
      const key = `custom_${row.name}`;
      (attrsByProperty[row.property_id] ||= {})[key] = row.value;
    }

    // Spread custom attributes onto each row
    for (const row of result.rows) {
      const attrs = attrsByProperty[row.id] || {};
      Object.assign(row, attrs);
    }

    // Add custom attribute columns dynamically
    const allAttrNames = new Set();
    for (const row of attrsResult.rows) {
      allAttrNames.add(row.name);
    }
    for (const name of allAttrNames) {
      const key = `custom_${name}`;
      if (!exportColumns.find(c => c.key === key)) {
        exportColumns.push({ key, label: name });
      }
    }
  }

  result.rows.exportColumns = exportColumns;

  return result.rows;
};

module.exports = {
  columns,
  xmlSchema,
  fetchData,
};
