const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Fetch custom attribute values for an array of bedroom IDs
 */
async function fetchCustomAttributes(bedroomIds, agencyId) {
  if (bedroomIds.length === 0) return {};

  const result = await db.query(`
    SELECT bav.bedroom_id, bav.attribute_definition_id, bav.value_text, bav.value_number, bav.value_boolean,
           bad.name, bad.attribute_type
    FROM bedroom_attribute_values bav
    JOIN bedroom_attribute_definitions bad ON bad.id = bav.attribute_definition_id
    WHERE bav.bedroom_id = ANY($1) AND bav.agency_id = $2
    ORDER BY bad.display_order ASC
  `, [bedroomIds, agencyId], agencyId);

  const byBedroom = {};
  for (const row of result.rows) {
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
}

/**
 * Save custom attributes for a bedroom (UPSERT)
 * @param {number} bedroomId
 * @param {number} agencyId
 * @param {Object} attributes - { definitionId: value, ... }
 */
async function saveCustomAttributes(bedroomId, agencyId, attributes) {
  if (!attributes || Object.keys(attributes).length === 0) return;

  // Fetch definitions to know each attribute's type
  const defIds = Object.keys(attributes).map(Number);
  const defsResult = await db.query(
    'SELECT id, attribute_type FROM bedroom_attribute_definitions WHERE id = ANY($1) AND agency_id = $2',
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
      const num = Number(value);
      valueNumber = Number.isFinite(num) ? num : null;
    } else if (attrType === 'boolean') {
      valueBoolean = (value === true || value === 'true') ? true
        : (value === false || value === 'false') ? false
        : null;
    }

    await db.query(`
      INSERT INTO bedroom_attribute_values (bedroom_id, attribute_definition_id, agency_id, value_text, value_number, value_boolean)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (bedroom_id, attribute_definition_id)
      DO UPDATE SET value_text = $4, value_number = $5, value_boolean = $6, updated_at = CURRENT_TIMESTAMP
    `, [bedroomId, numDefId, agencyId, valueText, valueNumber, valueBoolean], agencyId);
  }
}

// Get all bedrooms for a property
exports.getBedroomsByProperty = asyncHandler(async (req, res) => {
  const { propertyId } = req.params;
  const agencyId = req.agencyId;

  // Defense-in-depth: explicit agency_id filtering
  const bedroomsResult = await db.query(
    'SELECT * FROM bedrooms WHERE property_id = $1 AND agency_id = $2 ORDER BY display_order ASC, id ASC',
    [propertyId, agencyId],
    agencyId
  );
  const bedrooms = bedroomsResult.rows;

  // Batch-fetch images and custom attributes
  const bedroomIds = bedrooms.map(b => b.id);
  const customAttrsByBedroom = await fetchCustomAttributes(bedroomIds, agencyId);

  const bedroomsWithImages = await Promise.all(bedrooms.map(async (bedroom) => {
    // Defense-in-depth: verify bedroom belongs to agency
    const imagesResult = await db.query(`
      SELECT i.file_path
      FROM images i
      WHERE i.bedroom_id = $1
      AND i.bedroom_id IN (SELECT id FROM bedrooms WHERE agency_id = $2)
      ORDER BY i.created_at ASC
    `, [bedroom.id, agencyId], agencyId);
    return {
      ...bedroom,
      images: imagesResult.rows.map(img => img.file_path),
      custom_attributes: customAttrsByBedroom[bedroom.id] || [],
    };
  }));

  res.json({ bedrooms: bedroomsWithImages });
}, 'fetch bedrooms');

// Create bedroom (admin only)
exports.createBedroom = asyncHandler(async (req, res) => {
  const { propertyId } = req.params;
  const { bedroom_name, price_pppw, bedroom_description, available_from, custom_attributes } = req.body;
  const agencyId = req.agencyId;

  if (!bedroom_name) {
    return res.status(400).json({ error: 'Bedroom name is required' });
  }

  // Check if property exists - defense-in-depth: explicit agency_id filtering
  const propertyResult = await db.query(
    'SELECT id FROM properties WHERE id = $1 AND agency_id = $2',
    [propertyId, agencyId],
    agencyId
  );
  if (!propertyResult.rows[0]) {
    return res.status(404).json({ error: 'Property not found' });
  }

  // Get the max display_order for this property - defense-in-depth: explicit agency_id filtering
  const maxOrderResult = await db.query(
    'SELECT MAX(display_order) as max_order FROM bedrooms WHERE property_id = $1 AND agency_id = $2',
    [propertyId, agencyId],
    agencyId
  );
  const displayOrder = (maxOrderResult.rows[0]?.max_order || 0) + 1;

  const result = await db.query(`
    INSERT INTO bedrooms (agency_id, property_id, bedroom_name, price_pppw, bedroom_description, available_from, display_order)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    agencyId,
    propertyId,
    bedroom_name,
    price_pppw || null,
    bedroom_description || null,
    available_from || null,
    displayOrder
  ], agencyId);

  const bedroom = result.rows[0];

  // Save custom attributes if provided
  await saveCustomAttributes(bedroom.id, agencyId, custom_attributes);

  // Fetch saved custom attributes to include in response
  const customAttrsByBedroom = await fetchCustomAttributes([bedroom.id], agencyId);

  res.status(201).json({
    message: 'Bedroom created successfully',
    bedroom: {
      ...bedroom,
      custom_attributes: customAttrsByBedroom[bedroom.id] || [],
    }
  });
}, 'create bedroom');

// Update bedroom (admin only)
exports.updateBedroom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { bedroom_name, price_pppw, bedroom_description, available_from, custom_attributes } = req.body;
  const agencyId = req.agencyId;

  // Defense-in-depth: explicit agency_id filtering
  const bedroomResult = await db.query(
    'SELECT id FROM bedrooms WHERE id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );
  if (!bedroomResult.rows[0]) {
    return res.status(404).json({ error: 'Bedroom not found' });
  }

  // Defense-in-depth: explicit agency_id in WHERE clause
  const result = await db.query(`
    UPDATE bedrooms SET
      bedroom_name = $1,
      price_pppw = $2,
      bedroom_description = $3,
      available_from = $4,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $5 AND agency_id = $6
    RETURNING *
  `, [bedroom_name, price_pppw, bedroom_description, available_from, id, agencyId], agencyId);

  const updatedBedroom = result.rows[0];

  // Save custom attributes if provided
  await saveCustomAttributes(Number(id), agencyId, custom_attributes);

  // Fetch saved custom attributes to include in response
  const customAttrsByBedroom = await fetchCustomAttributes([Number(id)], agencyId);

  res.json({
    message: 'Bedroom updated successfully',
    bedroom: {
      ...updatedBedroom,
      custom_attributes: customAttrsByBedroom[Number(id)] || [],
    }
  });
}, 'update bedroom');

// Delete bedroom (admin only)
exports.deleteBedroom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;

  // Defense-in-depth: explicit agency_id filtering
  const bedroomResult = await db.query(
    'SELECT id FROM bedrooms WHERE id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );
  if (!bedroomResult.rows[0]) {
    return res.status(404).json({ error: 'Bedroom not found' });
  }

  // Explicit agency_id for defense-in-depth
  await db.query('DELETE FROM bedrooms WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);

  res.json({ message: 'Bedroom deleted successfully' });
}, 'delete bedroom');

// Reorder bedrooms (admin only)
exports.reorderBedrooms = asyncHandler(async (req, res) => {
  const { propertyId } = req.params;
  const { bedroomIds } = req.body; // Array of bedroom IDs in the new order
  const agencyId = req.agencyId;

  if (!Array.isArray(bedroomIds) || bedroomIds.length === 0) {
    return res.status(400).json({ error: 'Bedroom IDs array is required' });
  }

  // Verify property exists - defense-in-depth: explicit agency_id filtering
  const propertyResult = await db.query(
    'SELECT id FROM properties WHERE id = $1 AND agency_id = $2',
    [propertyId, agencyId],
    agencyId
  );
  if (!propertyResult.rows[0]) {
    return res.status(404).json({ error: 'Property not found' });
  }

  // Verify all bedrooms belong to this property - defense-in-depth: explicit agency_id filtering
  const placeholders = bedroomIds.map((_, i) => `$${i + 3}`).join(',');
  const query = `SELECT id FROM bedrooms WHERE property_id = $1 AND agency_id = $2 AND id IN (${placeholders})`;
  const bedroomsResult = await db.query(query, [propertyId, agencyId, ...bedroomIds], agencyId);

  if (bedroomsResult.rows.length !== bedroomIds.length) {
    return res.status(400).json({ error: 'One or more bedrooms do not belong to this property' });
  }

  // Update display_order for each bedroom using a transaction
  // Defense-in-depth: explicit agency_id in WHERE clause
  await db.transaction(async (client) => {
    for (let index = 0; index < bedroomIds.length; index++) {
      const bedroomId = bedroomIds[index];
      await client.query(
        'UPDATE bedrooms SET display_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND agency_id = $3',
        [index + 1, bedroomId, agencyId]
      );
    }
  }, agencyId);

  res.json({ message: 'Bedrooms reordered successfully' });
}, 'reorder bedrooms');
