const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { validateRequiredFields } = require('../utils/validators');

const VALID_TYPES = ['text', 'number', 'boolean', 'dropdown'];

// Get all attribute definitions for the agency
exports.getDefinitions = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;

  const result = await db.query(
    'SELECT * FROM property_attribute_definitions WHERE agency_id = $1 ORDER BY display_order ASC, id ASC',
    [agencyId],
    agencyId
  );

  res.json({ definitions: result.rows });
}, 'fetch attribute definitions');

// Create a new attribute definition
exports.createDefinition = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { name, attribute_type, options, is_required } = req.body;

  validateRequiredFields(req.body, ['name', 'attribute_type']);

  if (!VALID_TYPES.includes(attribute_type)) {
    return res.status(400).json({ error: `Invalid attribute_type. Must be one of: ${VALID_TYPES.join(', ')}` });
  }

  if (attribute_type === 'dropdown') {
    if (!options || !Array.isArray(options) || options.length === 0) {
      return res.status(400).json({ error: 'Dropdown attributes require a non-empty options array' });
    }
  }

  // Get next display_order
  const orderResult = await db.query(
    'SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM property_attribute_definitions WHERE agency_id = $1',
    [agencyId],
    agencyId
  );

  const result = await db.query(`
    INSERT INTO property_attribute_definitions (agency_id, name, attribute_type, options, is_required, display_order)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [
    agencyId,
    name.trim(),
    attribute_type,
    attribute_type === 'dropdown' ? JSON.stringify(options) : null,
    is_required ? true : false,
    orderResult.rows[0].next_order
  ], agencyId);

  res.status(201).json({ definition: result.rows[0] });
}, 'create attribute definition');

// Update an attribute definition
exports.updateDefinition = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;
  const { name, attribute_type, options, is_required } = req.body;

  // Verify ownership
  const existing = await db.query(
    'SELECT id FROM property_attribute_definitions WHERE id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );

  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'Attribute definition not found' });
  }

  if (attribute_type && !VALID_TYPES.includes(attribute_type)) {
    return res.status(400).json({ error: `Invalid attribute_type. Must be one of: ${VALID_TYPES.join(', ')}` });
  }

  if (attribute_type === 'dropdown') {
    if (!options || !Array.isArray(options) || options.length === 0) {
      return res.status(400).json({ error: 'Dropdown attributes require a non-empty options array' });
    }
  }

  const result = await db.query(`
    UPDATE property_attribute_definitions SET
      name = COALESCE($1, name),
      attribute_type = COALESCE($2, attribute_type),
      options = $3,
      is_required = COALESCE($4, is_required),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $5 AND agency_id = $6
    RETURNING *
  `, [
    name ? name.trim() : null,
    attribute_type || null,
    attribute_type === 'dropdown' ? JSON.stringify(options) : null,
    is_required !== undefined ? (is_required ? true : false) : null,
    id,
    agencyId
  ], agencyId);

  res.json({ definition: result.rows[0] });
}, 'update attribute definition');

// Delete an attribute definition (cascades to values)
exports.deleteDefinition = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;

  const existing = await db.query(
    'SELECT id FROM property_attribute_definitions WHERE id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );

  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'Attribute definition not found' });
  }

  await db.query(
    'DELETE FROM property_attribute_definitions WHERE id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );

  res.json({ message: 'Attribute definition deleted successfully' });
}, 'delete attribute definition');

// Reorder attribute definitions
exports.reorderDefinitions = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { definitionIds } = req.body;

  if (!Array.isArray(definitionIds) || definitionIds.length === 0) {
    return res.status(400).json({ error: 'definitionIds must be a non-empty array' });
  }

  // Update each definition's display_order
  for (let i = 0; i < definitionIds.length; i++) {
    await db.query(
      'UPDATE property_attribute_definitions SET display_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND agency_id = $3',
      [i, definitionIds[i], agencyId],
      agencyId
    );
  }

  res.json({ message: 'Definitions reordered successfully' });
}, 'reorder attribute definitions');
