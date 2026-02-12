const db = require('../db');
const path = require('path');
const fs = require('fs');
const asyncHandler = require('../utils/asyncHandler');

// Middleware: Check if property images feature is enabled for this agency
exports.requirePropertyImagesEnabled = asyncHandler(async (req, res, next) => {
  const result = await db.systemQuery(
    'SELECT property_images_enabled FROM agencies WHERE id = $1',
    [req.agencyId]
  );
  if (result.rows[0]?.property_images_enabled !== true) {
    return res.status(403).json({ error: 'Property images are not enabled for this agency' });
  }
  next();
}, 'check property images feature');

// Upload images for property or bedroom
exports.uploadImages = asyncHandler(async (req, res) => {
  const { property_id, bedroom_id } = req.body;
  const agencyId = req.agencyId;

  if (!property_id) {
    return res.status(400).json({ error: 'Property ID required' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  // Verify property exists
  // Defense-in-depth: explicit agency_id filtering
  const propertyResult = await db.query('SELECT id FROM properties WHERE id = $1 AND agency_id = $2', [property_id, agencyId], agencyId);
  if (!propertyResult.rows[0]) {
    return res.status(404).json({ error: 'Property not found' });
  }

  // Verify bedroom exists if bedroom_id provided
  if (bedroom_id) {
    // Defense-in-depth: explicit agency_id filtering
    const bedroomResult = await db.query('SELECT id FROM bedrooms WHERE id = $1 AND agency_id = $2', [bedroom_id, agencyId], agencyId);
    if (!bedroomResult.rows[0]) {
      return res.status(404).json({ error: 'Bedroom not found' });
    }
  }

  const uploadedImages = [];

  for (const file of req.files) {
    const filePath = `/uploads/${file.filename}`;

    const imageResult = await db.query(
      `INSERT INTO images (agency_id, property_id, bedroom_id, file_path, file_size)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [agencyId, property_id, bedroom_id || null, filePath, file.size || null],
      agencyId
    );

    uploadedImages.push(filePath);
  }

  res.status(201).json({ message: 'Images uploaded successfully', images: uploadedImages });
}, 'upload images');

// Delete image
exports.deleteImage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;

  // Defense-in-depth: explicit agency_id filtering
  const imageResult = await db.query('SELECT * FROM images WHERE id = $1 AND property_id IN (SELECT id FROM properties WHERE agency_id = $2)', [id, agencyId], agencyId);
  const image = imageResult.rows[0];
  if (!image) {
    return res.status(404).json({ error: 'Image not found' });
  }

  // Delete file from filesystem
  const filePath = path.join(__dirname, '../../', image.file_path);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // Defense-in-depth: explicit agency_id filtering
  await db.query(
    `DELETE FROM images
     WHERE id = $1
     AND property_id IN (SELECT id FROM properties WHERE agency_id = $2)`,
    [id, agencyId],
    agencyId
  );

  res.json({ message: 'Image deleted successfully' });
}, 'delete image');

// Get all images for a property (property-level images only)
exports.getPropertyImages = asyncHandler(async (req, res) => {
  const { propertyId } = req.params;
  const agencyId = req.agencyId;

  // Get property-level images (bedroom_id IS NULL)
  // These will always show in property gallery, even if linked to bedrooms
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(
    `SELECT *
     FROM images
     WHERE property_id = $1
     AND bedroom_id IS NULL
     AND property_id IN (SELECT id FROM properties WHERE agency_id = $2)
     ORDER BY is_primary DESC, id ASC`,
    [propertyId, agencyId],
    agencyId
  );

  res.json({ images: result.rows });
}, 'fetch images');

// Get all images for a bedroom
exports.getBedroomImages = asyncHandler(async (req, res) => {
  const { bedroomId } = req.params;
  const agencyId = req.agencyId;

  // Get bedroom images directly via images.bedroom_id
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(
    `SELECT i.id, i.file_path, i.is_primary, i.created_at
     FROM images i
     WHERE i.bedroom_id = $1
     AND i.bedroom_id IN (SELECT id FROM bedrooms WHERE agency_id = $2)
     ORDER BY i.created_at ASC`,
    [bedroomId, agencyId],
    agencyId
  );

  res.json({ images: result.rows });
}, 'fetch images');

// Set image as primary for a property
exports.setPrimaryImage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;

  // Get the image to check if it exists and get its property_id
  // Defense-in-depth: explicit agency_id filtering
  const imageResult = await db.query('SELECT * FROM images WHERE id = $1 AND property_id IN (SELECT id FROM properties WHERE agency_id = $2)', [id, agencyId], agencyId);
  const image = imageResult.rows[0];

  if (!image) {
    return res.status(404).json({ error: 'Image not found' });
  }

  if (!image.property_id) {
    return res.status(400).json({ error: 'Cannot set primary image without property_id' });
  }

  // First, unset any existing primary image for this property
  // Defense-in-depth: explicit agency_id filtering
  await db.query(
    'UPDATE images SET is_primary = false WHERE property_id = $1 AND property_id IN (SELECT id FROM properties WHERE agency_id = $2)',
    [image.property_id, agencyId],
    agencyId
  );

  // Set this image as primary
  // Defense-in-depth: explicit agency_id filtering
  await db.query('UPDATE images SET is_primary = true WHERE id = $1 AND property_id IN (SELECT id FROM properties WHERE agency_id = $2)', [id, agencyId], agencyId);

  res.json({ message: 'Primary image set successfully' });
}, 'set primary image');

// Link an existing property image to a bedroom
exports.linkImageToBedroom = asyncHandler(async (req, res) => {
  const { imageId, bedroomId } = req.body;
  const agencyId = req.agencyId;

  if (!imageId || !bedroomId) {
    return res.status(400).json({ error: 'Image ID and Bedroom ID required' });
  }

  // Verify image exists
  // Defense-in-depth: explicit agency_id filtering
  const imageResult = await db.query('SELECT id, property_id, bedroom_id FROM images WHERE id = $1 AND property_id IN (SELECT id FROM properties WHERE agency_id = $2)', [imageId, agencyId], agencyId);
  const image = imageResult.rows[0];
  if (!image) {
    return res.status(404).json({ error: 'Image not found' });
  }

  // Verify bedroom exists and belongs to same property
  // Defense-in-depth: explicit agency_id filtering
  const bedroomResult = await db.query('SELECT id, property_id FROM bedrooms WHERE id = $1 AND agency_id = $2', [bedroomId, agencyId], agencyId);
  const bedroom = bedroomResult.rows[0];
  if (!bedroom) {
    return res.status(404).json({ error: 'Bedroom not found' });
  }

  if (bedroom.property_id !== image.property_id) {
    return res.status(400).json({ error: 'Bedroom and image must belong to same property' });
  }

  // Check if image is already linked to this bedroom
  if (image.bedroom_id && image.bedroom_id === parseInt(bedroomId)) {
    return res.status(400).json({ error: 'Image already linked to this bedroom' });
  }

  // Link the image to the bedroom by setting bedroom_id
  // Defense-in-depth: explicit agency_id filtering
  await db.query(
    'UPDATE images SET bedroom_id = $1 WHERE id = $2 AND property_id IN (SELECT id FROM properties WHERE agency_id = $3)',
    [bedroomId, imageId, agencyId],
    agencyId
  );

  res.status(201).json({ message: 'Image linked to bedroom successfully' });
}, 'link image to bedroom');

// Unlink an image from a bedroom
// Deletes bedroom-specific images entirely, but just unlinks property images
exports.unlinkImageFromBedroom = asyncHandler(async (req, res) => {
  const { imageId, bedroomId } = req.body;
  const agencyId = req.agencyId;

  if (!imageId || !bedroomId) {
    return res.status(400).json({ error: 'Image ID and Bedroom ID required' });
  }

  // Get image details to check if it's linked to this bedroom
  // Defense-in-depth: explicit agency_id filtering
  const imageResult = await db.query('SELECT * FROM images WHERE id = $1 AND property_id IN (SELECT id FROM properties WHERE agency_id = $2)', [imageId, agencyId], agencyId);
  const image = imageResult.rows[0];

  if (!image) {
    return res.status(404).json({ error: 'Image not found' });
  }

  if (!image.bedroom_id || image.bedroom_id !== parseInt(bedroomId)) {
    return res.status(404).json({ error: 'Image is not linked to this bedroom' });
  }

  // Unlink the image from the bedroom by setting bedroom_id to NULL
  // Defense-in-depth: explicit agency_id filtering
  await db.query(
    `UPDATE images SET bedroom_id = NULL
     WHERE id = $1
     AND property_id IN (SELECT id FROM properties WHERE agency_id = $2)`,
    [imageId, agencyId],
    agencyId
  );

  res.json({
    message: 'Image unlinked from bedroom successfully',
    deleted: false
  });
}, 'unlink image from bedroom');
