const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { validateRequiredFields } = require('../utils/validators');

const VALID_TYPES = ['text', 'number', 'boolean', 'dropdown'];

// Get all bedroom attribute definitions for the agency
exports.getDefinitions = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;

  const result = await db.query(
    'SELECT * FROM bedroom_attribute_definitions WHERE agency_id = $1 ORDER BY display_order ASC, id ASC',
    [agencyId],
    agencyId
  );

  res.json({ definitions: result.rows });
}, 'fetch bedroom attribute definitions');

// Create a new bedroom attribute definition
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
    'SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM bedroom_attribute_definitions WHERE agency_id = $1',
    [agencyId],
    agencyId
  );

  const result = await db.query(`
    INSERT INTO bedroom_attribute_definitions (agency_id, name, attribute_type, options, is_required, display_order)
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
}, 'create bedroom attribute definition');

// Update a bedroom attribute definition
exports.updateDefinition = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;
  const { name, attribute_type, options, is_required } = req.body;

  // Verify ownership
  const existing = await db.query(
    'SELECT id FROM bedroom_attribute_definitions WHERE id = $1 AND agency_id = $2',
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
    UPDATE bedroom_attribute_definitions SET
      name = COALESCE($1, name),
      attribute_type = COALESCE($2, attribute_type),
      options = CASE
        WHEN $2 = 'dropdown' THEN COALESCE($3, options)
        WHEN $2 IS NOT NULL THEN NULL
        ELSE options
      END,
      is_required = COALESCE($4, is_required),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $5 AND agency_id = $6
    RETURNING *
  `, [
    name ? name.trim() : null,
    attribute_type || null,
    (attribute_type === 'dropdown' && options) ? JSON.stringify(options) : null,
    is_required !== undefined ? (is_required ? true : false) : null,
    id,
    agencyId
  ], agencyId);

  res.json({ definition: result.rows[0] });
}, 'update bedroom attribute definition');

// Delete a bedroom attribute definition (cascades to values)
exports.deleteDefinition = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;

  const existing = await db.query(
    'SELECT id FROM bedroom_attribute_definitions WHERE id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );

  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'Attribute definition not found' });
  }

  await db.query(
    'DELETE FROM bedroom_attribute_definitions WHERE id = $1 AND agency_id = $2',
    [id, agencyId],
    agencyId
  );

  res.json({ message: 'Attribute definition deleted successfully' });
}, 'delete bedroom attribute definition');

// Reorder bedroom attribute definitions
exports.reorderDefinitions = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { definitionIds } = req.body;

  if (!Array.isArray(definitionIds) || definitionIds.length === 0) {
    return res.status(400).json({ error: 'definitionIds must be a non-empty array' });
  }

  // Reject duplicate IDs before entering transaction
  const uniqueIds = new Set(definitionIds.map(Number));
  if (uniqueIds.size !== definitionIds.length) {
    return res.status(400).json({ error: 'definitionIds must not contain duplicates' });
  }

  await db.transaction(async (client) => {
    // Validate submitted list is the full set for this agency
    const allDefs = await client.query(
      'SELECT id FROM bedroom_attribute_definitions WHERE agency_id = $1',
      [agencyId]
    );
    const storedIds = new Set(allDefs.rows.map(r => r.id));
    if (storedIds.size !== uniqueIds.size || ![...storedIds].every(id => uniqueIds.has(id))) {
      throw Object.assign(new Error('definitionIds must contain exactly all definitions for this agency'), { statusCode: 400 });
    }

    for (let i = 0; i < definitionIds.length; i++) {
      await client.query(
        'UPDATE bedroom_attribute_definitions SET display_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND agency_id = $3',
        [i, definitionIds[i], agencyId]
      );
    }
  }, agencyId);

  res.json({ message: 'Definitions reordered successfully' });
}, 'reorder bedroom attribute definitions');
