const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');

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
      images: imagesResult.rows.map(img => img.file_path)
    };
  }));

  res.json({ bedrooms: bedroomsWithImages });
}, 'fetch bedrooms');

// Create bedroom (admin only)
exports.createBedroom = asyncHandler(async (req, res) => {
  const { propertyId } = req.params;
  const { bedroom_name, status, price_pppw, bedroom_description, available_from, youtube_url } = req.body;
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
    INSERT INTO bedrooms (agency_id, property_id, bedroom_name, status, price_pppw, bedroom_description, available_from, youtube_url, display_order)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `, [
    agencyId,
    propertyId,
    bedroom_name,
    status || 'available',
    price_pppw || null,
    bedroom_description || null,
    available_from || null,
    youtube_url || null,
    displayOrder
  ], agencyId);

  const bedroom = result.rows[0];

  res.status(201).json({ message: 'Bedroom created successfully', bedroom });
}, 'create bedroom');

// Update bedroom (admin only)
exports.updateBedroom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { bedroom_name, status, price_pppw, bedroom_description, available_from, youtube_url } = req.body;
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
      status = $2,
      price_pppw = $3,
      bedroom_description = $4,
      available_from = $5,
      youtube_url = $6,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $7 AND agency_id = $8
    RETURNING *
  `, [bedroom_name, status, price_pppw, bedroom_description, available_from, youtube_url, id, agencyId], agencyId);

  const updatedBedroom = result.rows[0];

  res.json({ message: 'Bedroom updated successfully', bedroom: updatedBedroom });
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
