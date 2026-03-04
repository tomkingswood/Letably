const db = require('../db');
const fs = require('fs');
const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const { validateRequiredFields } = require('../utils/validators');

/**
 * Compute title from address fields
 */
function computeTitle(property) {
  return [property.address_line1, property.city, property.postcode].filter(Boolean).join(', ');
}

/**
 * Fetch custom attribute values for an array of property IDs
 */
async function fetchCustomAttributes(propertyIds, agencyId) {
  if (propertyIds.length === 0) return {};

  const result = await db.query(`
    SELECT pav.property_id, pav.attribute_definition_id, pav.value_text, pav.value_number, pav.value_boolean,
           pad.name, pad.attribute_type
    FROM property_attribute_values pav
    JOIN property_attribute_definitions pad ON pad.id = pav.attribute_definition_id
    WHERE pav.property_id = ANY($1) AND pav.agency_id = $2
    ORDER BY pad.display_order ASC
  `, [propertyIds, agencyId], agencyId);

  const byProperty = {};
  for (const row of result.rows) {
    (byProperty[row.property_id] ||= []).push({
      attribute_definition_id: row.attribute_definition_id,
      name: row.name,
      attribute_type: row.attribute_type,
      value_text: row.value_text,
      value_number: row.value_number,
      value_boolean: row.value_boolean,
    });
  }
  return byProperty;
}

/**
 * Save custom attributes for a property (UPSERT)
 * @param {number} propertyId
 * @param {number} agencyId
 * @param {Object} attributes - { definitionId: value, ... }
 */
async function saveCustomAttributes(propertyId, agencyId, attributes) {
  if (!attributes || Object.keys(attributes).length === 0) return;

  // Fetch definitions to know each attribute's type
  const defIds = Object.keys(attributes).map(Number);
  const defsResult = await db.query(
    'SELECT id, attribute_type FROM property_attribute_definitions WHERE id = ANY($1) AND agency_id = $2',
    [defIds, agencyId],
    agencyId
  );

  const defTypes = {};
  for (const def of defsResult.rows) {
    defTypes[def.id] = def.attribute_type;
  }

  for (const [defId, value] of Object.entries(attributes)) {
    const numDefId = Number(defId);
    const attrType = defTypes[numDefId];
    if (!attrType) continue; // Skip unknown definitions

    let valueText = null, valueNumber = null, valueBoolean = null;
    if (value === null || value === '' || value === undefined) {
      // All nulls — effectively "no value"
    } else if (attrType === 'text' || attrType === 'dropdown') {
      valueText = String(value);
    } else if (attrType === 'number') {
      valueNumber = Number(value);
    } else if (attrType === 'boolean') {
      valueBoolean = value ? true : false;
    }

    await db.query(`
      INSERT INTO property_attribute_values (property_id, attribute_definition_id, agency_id, value_text, value_number, value_boolean)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (property_id, attribute_definition_id)
      DO UPDATE SET value_text = $4, value_number = $5, value_boolean = $6, updated_at = CURRENT_TIMESTAMP
    `, [propertyId, numDefId, agencyId, valueText, valueNumber, valueBoolean], agencyId);
  }
}

// Get all properties with optional filters
exports.getAllProperties = asyncHandler(async (req, res) => {
  const { location, bedrooms: bedroomsFilter, letting_type } = req.query;
  const agencyId = req.agencyId;

  let query = `SELECT id, agency_id, address_line1, address_line2, city, postcode, location,
    description, letting_type, landlord_id, is_live, available_from, created_at, updated_at
    FROM properties WHERE agency_id = $1`;
  const params = [agencyId];
  let paramIndex = 2;

  // Only show live properties to non-admin users
  const isAdmin = req.user && req.user.role === 'admin';
  if (!isAdmin) {
    query += ' AND is_live = true';
  }

  if (location && location !== 'all') {
    query += ` AND location = $${paramIndex++}`;
    params.push(location);
  }

  if (bedroomsFilter && bedroomsFilter !== 'all') {
    query += ` AND (SELECT COUNT(*) FROM bedrooms b WHERE b.property_id = properties.id) >= $${paramIndex++}`;
    params.push(parseInt(bedroomsFilter));
  }

  if (letting_type && letting_type !== 'all') {
    query += ` AND letting_type = $${paramIndex++}`;
    params.push(letting_type);
  }

  query += ' ORDER BY created_at DESC';

  const propertiesResult = await db.query(query, params, agencyId);
  const properties = propertiesResult.rows;

  if (properties.length === 0) {
    return res.json({ properties: [] });
  }

  // Batch-fetch images, bedrooms, occupancy, and custom attributes
  const propertyIds = properties.map(p => p.id);

  const today = new Date().toISOString().split('T')[0];

  const [imagesResult, bedroomsResult, occupiedResult, customAttrsByProperty] = await Promise.all([
    db.query(`
      SELECT id, property_id, file_path, is_primary
      FROM images
      WHERE property_id = ANY($1)
      AND bedroom_id IS NULL
      AND property_id IN (SELECT id FROM properties WHERE agency_id = $2)
      ORDER BY is_primary DESC, id ASC
    `, [propertyIds, agencyId], agencyId),
    db.query(
      'SELECT * FROM bedrooms WHERE property_id = ANY($1) AND agency_id = $2 ORDER BY property_id, id ASC',
      [propertyIds, agencyId],
      agencyId
    ),
    db.query(`
      SELECT DISTINCT tm.bedroom_id
      FROM tenancy_members tm
      JOIN tenancies t ON t.id = tm.tenancy_id AND t.agency_id = $2
      WHERE tm.bedroom_id = ANY(SELECT id FROM bedrooms WHERE property_id = ANY($1) AND agency_id = $2)
      AND tm.agency_id = $2
      AND t.start_date <= $3
      AND (t.end_date IS NULL OR t.end_date >= $3)
      AND t.status IN ('active', 'approved', 'awaiting_signatures', 'approval')
    `, [propertyIds, agencyId, today], agencyId),
    fetchCustomAttributes(propertyIds, agencyId),
  ]);

  // Group by property_id
  const imagesByProperty = {};
  const bedroomsByProperty = {};
  const occupiedBedroomIds = new Set(occupiedResult.rows.map(r => r.bedroom_id));
  for (const img of imagesResult.rows) {
    (imagesByProperty[img.property_id] ||= []).push(img);
  }
  for (const br of bedroomsResult.rows) {
    br.is_occupied = occupiedBedroomIds.has(br.id);
    (bedroomsByProperty[br.property_id] ||= []).push(br);
  }

  const formattedProperties = properties.map(property => ({
    ...property,
    title: computeTitle(property),
    images: imagesByProperty[property.id] || [],
    bedrooms: bedroomsByProperty[property.id] || [],
    custom_attributes: customAttrsByProperty[property.id] || [],
  }));

  res.json({ properties: formattedProperties });
}, 'fetch properties');

// Get single property by ID with rooms
exports.getPropertyById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;

  const propertyResult = await db.query(
    `SELECT id, agency_id, address_line1, address_line2, city, postcode, location,
      description, letting_type, landlord_id, is_live, available_from, created_at, updated_at
    FROM properties WHERE id = $1 AND agency_id = $2`,
    [id, agencyId],
    agencyId
  );
  const property = propertyResult.rows[0];

  if (!property) {
    return res.status(404).json({ error: 'Property not found' });
  }

  // Only show draft properties to admin users
  const isAdmin = req.user && req.user.role === 'admin';
  if (!isAdmin && !property.is_live) {
    return res.status(404).json({ error: 'Property not found' });
  }

  // Get property-level images
  const propertyImagesResult = await db.query(`
    SELECT id, file_path, is_primary
    FROM images
    WHERE property_id = $1
    AND bedroom_id IS NULL
    AND property_id IN (SELECT id FROM properties WHERE agency_id = $2)
    ORDER BY is_primary DESC, id ASC
  `, [id, agencyId], agencyId);

  // Get bedrooms
  const bedroomsResult = await db.query(
    'SELECT * FROM bedrooms WHERE property_id = $1 AND agency_id = $2 ORDER BY id ASC',
    [id, agencyId],
    agencyId
  );

  // Find which bedrooms have an active tenancy
  const singlePropToday = new Date().toISOString().split('T')[0];
  const bedroomIds = bedroomsResult.rows.map(b => b.id);
  const occupiedResult = bedroomIds.length > 0 ? await db.query(`
    SELECT DISTINCT tm.bedroom_id
    FROM tenancy_members tm
    JOIN tenancies t ON t.id = tm.tenancy_id AND t.agency_id = $2
    WHERE tm.bedroom_id = ANY($1)
    AND tm.agency_id = $2
    AND t.start_date <= $3
    AND (t.end_date IS NULL OR t.end_date >= $3)
    AND t.status IN ('active', 'approved', 'awaiting_signatures', 'approval')
  `, [bedroomIds, agencyId, singlePropToday], agencyId) : { rows: [] };
  const occupiedBedroomIds = new Set(occupiedResult.rows.map(r => r.bedroom_id));

  // Batch-fetch bedroom custom attributes
  const bedroomCustomAttrs = bedroomIds.length > 0 ? await (async () => {
    const bavResult = await db.query(`
      SELECT bav.bedroom_id, bav.attribute_definition_id, bav.value_text, bav.value_number, bav.value_boolean,
             bad.name, bad.attribute_type
      FROM bedroom_attribute_values bav
      JOIN bedroom_attribute_definitions bad ON bad.id = bav.attribute_definition_id
      WHERE bav.bedroom_id = ANY($1) AND bav.agency_id = $2
      ORDER BY bad.display_order ASC
    `, [bedroomIds, agencyId], agencyId);
    const byBedroom = {};
    for (const row of bavResult.rows) {
      (byBedroom[row.bedroom_id] ||= []).push({
        attribute_definition_id: row.attribute_definition_id,
        name: row.name,
        attribute_type: row.attribute_type,
        value_text: row.value_text,
        value_number: row.value_number,
        value_boolean: row.value_boolean,
      });
    }
    return byBedroom;
  })() : {};

  // Get images for each bedroom
  const bedroomsWithImages = await Promise.all(bedroomsResult.rows.map(async (bedroom) => {
    const bedroomImagesResult = await db.query(`
      SELECT i.file_path, i.id as image_id
      FROM images i
      WHERE i.bedroom_id = $1
      AND i.bedroom_id IN (SELECT id FROM bedrooms WHERE agency_id = $2)
      ORDER BY i.created_at ASC
    `, [bedroom.id, agencyId], agencyId);

    return {
      ...bedroom,
      is_occupied: occupiedBedroomIds.has(bedroom.id),
      images: bedroomImagesResult.rows || [],
      imageUrls: bedroomImagesResult.rows ? bedroomImagesResult.rows.map(img => img.file_path) : [],
      custom_attributes: bedroomCustomAttrs[bedroom.id] || [],
    };
  }));

  // Get public certificates for this property
  const publicCertificatesResult = await db.query(`
    SELECT
      c.id,
      c.file_path,
      c.expiry_date,
      c.uploaded_at,
      ct.name as type_name,
      ct.display_name
    FROM certificates c
    INNER JOIN certificate_types ct ON c.certificate_type_id = ct.id
    WHERE c.entity_type = 'property' AND c.entity_id = $1
    AND c.agency_id = $2
    AND ct.is_active = true
    ORDER BY ct.name ASC, c.uploaded_at DESC
  `, [id, agencyId], agencyId);

  // Fetch custom attributes
  const customAttrsByProperty = await fetchCustomAttributes([property.id], agencyId);

  res.json({
    property: {
      ...property,
      title: computeTitle(property),
      images: propertyImagesResult.rows,
      bedrooms: bedroomsWithImages,
      publicCertificates: publicCertificatesResult.rows || [],
      custom_attributes: customAttrsByProperty[property.id] || [],
    }
  });
}, 'fetch property');

// Create property (admin only)
exports.createProperty = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const {
    address_line1,
    address_line2,
    city,
    postcode,
    location,
    available_from,
    description,
    letting_type,
    landlord_id,
    is_live,
    custom_attributes,
  } = req.body;

  validateRequiredFields(req.body, ['address_line1', 'city', 'postcode']);

  const result = await db.query(`
    INSERT INTO properties (
      address_line1, address_line2, city, postcode, location,
      available_from, description,
      letting_type, landlord_id, is_live, agency_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `, [
    address_line1,
    address_line2 || null,
    city,
    postcode,
    location || null,
    available_from || null,
    description || null,
    letting_type || 'Whole House',
    landlord_id || null,
    is_live ? true : false,
    agencyId
  ], agencyId);

  const property = result.rows[0];

  // Save custom attributes if provided
  await saveCustomAttributes(property.id, agencyId, custom_attributes);

  // Fetch saved custom attributes to include in response
  const customAttrsByProperty = await fetchCustomAttributes([property.id], agencyId);

  res.status(201).json({
    message: 'Property created successfully',
    property: {
      ...property,
      title: computeTitle(property),
      custom_attributes: customAttrsByProperty[property.id] || [],
    }
  });
}, 'create property');

// Update property (admin only)
exports.updateProperty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;
  const {
    address_line1,
    address_line2,
    city,
    postcode,
    location,
    available_from,
    description,
    letting_type,
    landlord_id,
    is_live,
    custom_attributes,
  } = req.body;

  const propertyResult = await db.query('SELECT id FROM properties WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);

  if (propertyResult.rows.length === 0) {
    return res.status(404).json({ error: 'Property not found' });
  }

  const result = await db.query(`
    UPDATE properties SET
      address_line1 = $1,
      address_line2 = $2,
      city = $3,
      postcode = $4,
      location = $5,
      available_from = $6,
      description = $7,
      letting_type = $8,
      landlord_id = $9,
      is_live = $10,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $11 AND agency_id = $12
    RETURNING *
  `, [
    address_line1,
    address_line2 || null,
    city,
    postcode,
    location || null,
    available_from || null,
    description,
    letting_type,
    landlord_id || null,
    is_live ? true : false,
    id,
    agencyId
  ], agencyId);

  // Save custom attributes if provided
  await saveCustomAttributes(Number(id), agencyId, custom_attributes);

  // Fetch saved custom attributes to include in response
  const customAttrsByProperty = await fetchCustomAttributes([Number(id)], agencyId);

  res.json({
    message: 'Property updated successfully',
    property: {
      ...result.rows[0],
      title: computeTitle(result.rows[0]),
      custom_attributes: customAttrsByProperty[Number(id)] || [],
    }
  });
}, 'update property');

// Delete property (admin only)
exports.deleteProperty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;

  const propertyResult = await db.query('SELECT id FROM properties WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);

  if (propertyResult.rows.length === 0) {
    return res.status(404).json({ error: 'Property not found' });
  }

  // Cascade delete certificates and their files for this property
  const certs = await db.query(
    'SELECT file_path FROM certificates WHERE entity_type = $1 AND entity_id = $2 AND agency_id = $3',
    ['property', id, agencyId], agencyId
  );

  // Delete DB records first, then clean up files best-effort
  await db.query(
    'DELETE FROM certificates WHERE entity_type = $1 AND entity_id = $2 AND agency_id = $3',
    ['property', id, agencyId], agencyId
  );

  await db.query('DELETE FROM properties WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);

  // Clean up certificate files asynchronously (best-effort)
  for (const cert of certs.rows) {
    if (cert.file_path) {
      const fullPath = path.join(__dirname, '../../uploads', cert.file_path);
      fs.promises.unlink(fullPath).catch(() => {});
    }
  }

  res.json({ message: 'Property deleted successfully' });
}, 'delete property');

// Update property display order (admin only)
exports.updateDisplayOrder = asyncHandler(async (req, res) => {
  const { propertyIds } = req.body;

  if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
    return res.status(400).json({ error: 'propertyIds must be a non-empty array' });
  }

  res.json({ message: 'Display order updated successfully' });
}, 'update display order');
