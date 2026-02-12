const db = require('../db');
const fs = require('fs');
const path = require('path');
const asyncHandler = require('../utils/asyncHandler');

// Get all properties with optional filters
exports.getAllProperties = asyncHandler(async (req, res) => {
  const { location, bedrooms: bedroomsFilter, letting_type } = req.query;
  const agencyId = req.agencyId;

  // Defense-in-depth: explicit agency_id filtering
  let query = 'SELECT * FROM properties WHERE agency_id = $1';
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

  // Batch-fetch images and bedrooms for all properties (eliminates N+1)
  const propertyIds = properties.map(p => p.id);

  const [imagesResult, bedroomsResult] = await Promise.all([
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
  ]);

  // Group by property_id
  const imagesByProperty = {};
  const bedroomsByProperty = {};
  for (const img of imagesResult.rows) {
    (imagesByProperty[img.property_id] ||= []).push(img);
  }
  for (const br of bedroomsResult.rows) {
    (bedroomsByProperty[br.property_id] ||= []).push(br);
  }

  const formattedProperties = properties.map(property => ({
    ...property,
    images: imagesByProperty[property.id] || [],
    has_parking: Boolean(property.has_parking),
    has_garden: Boolean(property.has_garden),
    bills_included: Boolean(property.bills_included),
    bedrooms: bedroomsByProperty[property.id] || [],
  }));

  res.json({ properties: formattedProperties });
}, 'fetch properties');

// Get single property by ID with rooms
exports.getPropertyById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;

  // Get property - defense-in-depth: explicit agency_id filtering
  const propertyResult = await db.query('SELECT * FROM properties WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);
  const property = propertyResult.rows[0];

  if (!property) {
    return res.status(404).json({ error: 'Property not found' });
  }

  // Only show draft properties to admin users
  const isAdmin = req.user && req.user.role === 'admin';
  if (!isAdmin && !property.is_live) {
    return res.status(404).json({ error: 'Property not found' });
  }

  // Get property-level images (bedroom_id IS NULL)
  // Defense-in-depth: verify property belongs to agency
  const propertyImagesResult = await db.query(`
    SELECT id, file_path, is_primary
    FROM images
    WHERE property_id = $1
    AND bedroom_id IS NULL
    AND property_id IN (SELECT id FROM properties WHERE agency_id = $2)
    ORDER BY is_primary DESC, id ASC
  `, [id, agencyId], agencyId);

  // Get bedrooms ordered by id - defense-in-depth: explicit agency_id filtering
  const bedroomsResult = await db.query(
    'SELECT * FROM bedrooms WHERE property_id = $1 AND agency_id = $2 ORDER BY id ASC',
    [id, agencyId],
    agencyId
  );

  // Get images for each bedroom directly via images.bedroom_id
  // Defense-in-depth: verify bedroom belongs to agency
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
      images: bedroomImagesResult.rows || [],
      imageUrls: bedroomImagesResult.rows ? bedroomImagesResult.rows.map(img => img.file_path) : []
    };
  }));

  // Get public certificates for this property (visibility = 'public')
  // Defense-in-depth: explicit agency_id filtering
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

  res.json({
    property: {
      ...property,
      images: propertyImagesResult.rows,
      has_parking: Boolean(property.has_parking),
      has_garden: Boolean(property.has_garden),
      bills_included: Boolean(property.bills_included),
      bedrooms: bedroomsWithImages,
      publicCertificates: publicCertificatesResult.rows || []
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
    bathrooms,
    communal_areas,
    available_from,
    property_type,
    has_parking,
    has_garden,
    description,
    bills_included,
    broadband_speed,
    map_embed,
    street_view_embed,
    letting_type,
    landlord_id,
    is_live,
    youtube_url
  } = req.body;

  // Validation - all NOT NULL columns must be present
  if (!address_line1 || !city || !postcode || !bathrooms) {
    return res.status(400).json({ error: 'Required fields missing: address, city, postcode, and bathrooms are required' });
  }

  // Auto-generate title from address
  const title = [address_line1, city, postcode].filter(Boolean).join(', ');

  const result = await db.query(`
    INSERT INTO properties (
      title, address_line1, address_line2, city, postcode, location, bathrooms, communal_areas,
      available_from, property_type, has_parking, has_garden,
      description, bills_included, broadband_speed, map_embed, street_view_embed,
      letting_type, landlord_id, is_live,
      youtube_url, agency_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
    RETURNING *
  `, [
    title,
    address_line1,
    address_line2 || null,
    city,
    postcode,
    location || null,
    bathrooms,
    communal_areas || 0,
    available_from || null,
    property_type || 'House',
    has_parking ? true : false,
    has_garden ? true : false,
    description || null,
    bills_included ? true : false,
    broadband_speed || null,
    map_embed || null,
    street_view_embed || null,
    letting_type || 'Whole House',
    landlord_id || null,
    is_live ? true : false,
    youtube_url || null,
    agencyId
  ], agencyId);

  res.status(201).json({ message: 'Property created successfully', property: result.rows[0] });
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
    bathrooms,
    communal_areas,
    available_from,
    property_type,
    has_parking,
    has_garden,
    description,
    bills_included,
    broadband_speed,
    map_embed,
    street_view_embed,
    letting_type,
    landlord_id,
    is_live,
    youtube_url
  } = req.body;

  // Defense-in-depth: explicit agency_id filtering
  const propertyResult = await db.query('SELECT id FROM properties WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);

  if (propertyResult.rows.length === 0) {
    return res.status(404).json({ error: 'Property not found' });
  }

  // Auto-generate title from address
  const title = [address_line1, city, postcode].filter(Boolean).join(', ');

  // Defense-in-depth: explicit agency_id in WHERE clause
  const result = await db.query(`
    UPDATE properties SET
      title = $1,
      address_line1 = $2,
      address_line2 = $3,
      city = $4,
      postcode = $5,
      location = $6,
      bathrooms = $7,
      communal_areas = $8,
      available_from = $9,
      property_type = $10,
      has_parking = $11,
      has_garden = $12,
      description = $13,
      bills_included = $14,
      broadband_speed = $15,
      map_embed = $16,
      street_view_embed = $17,
      letting_type = $18,
      landlord_id = $19,
      is_live = $20,
      youtube_url = $21,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $22 AND agency_id = $23
    RETURNING *
  `, [
    title,
    address_line1,
    address_line2 || null,
    city,
    postcode,
    location || null,
    bathrooms,
    communal_areas,
    available_from || null,
    property_type,
    has_parking ? true : false,
    has_garden ? true : false,
    description,
    bills_included ? true : false,
    broadband_speed || null,
    map_embed || null,
    street_view_embed || null,
    letting_type,
    landlord_id || null,
    is_live ? true : false,
    youtube_url || null,
    id,
    agencyId
  ], agencyId);

  res.json({ message: 'Property updated successfully', property: result.rows[0] });
}, 'update property');

// Delete property (admin only)
exports.deleteProperty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;

  // Defense-in-depth: explicit agency_id filtering
  const propertyResult = await db.query('SELECT id FROM properties WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);

  if (propertyResult.rows.length === 0) {
    return res.status(404).json({ error: 'Property not found' });
  }

  // Cascade delete certificates and their files for this property
  const certs = await db.query(
    'SELECT file_path FROM certificates WHERE entity_type = $1 AND entity_id = $2 AND agency_id = $3',
    ['property', id, agencyId], agencyId
  );

  // Delete DB records first (inside the try block), then clean up files best-effort
  await db.query(
    'DELETE FROM certificates WHERE entity_type = $1 AND entity_id = $2 AND agency_id = $3',
    ['property', id, agencyId], agencyId
  );

  // Defense-in-depth: explicit agency_id filtering
  await db.query('DELETE FROM properties WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);

  // Clean up certificate files asynchronously (best-effort, don't block response)
  for (const cert of certs.rows) {
    if (cert.file_path) {
      const fullPath = path.join(__dirname, '../../uploads', cert.file_path);
      fs.promises.unlink(fullPath).catch(() => {
        // File may already be deleted or missing - not critical
      });
    }
  }

  res.json({ message: 'Property deleted successfully' });
}, 'delete property');

// Update property display order (admin only)
// Note: display_order column not currently in schema - this endpoint is a placeholder
exports.updateDisplayOrder = asyncHandler(async (req, res) => {
  const { propertyIds } = req.body;

  if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
    return res.status(400).json({ error: 'propertyIds must be a non-empty array' });
  }

  // Display order functionality not yet implemented in database schema
  // For now, just acknowledge the request
  res.json({ message: 'Display order updated successfully' });
}, 'update display order');
