const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');

// Get all certificate types (optionally filtered by type)
exports.getAll = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { type } = req.query;

  const validTypes = ['property', 'agency', 'tenancy'];
  if (type && !validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
  }

  let query = `
    SELECT * FROM certificate_types
    WHERE is_active = true AND agency_id = $1
  `;
  const params = [agencyId];

  if (type) {
    params.push(type);
    query += ` AND type = $${params.length}`;
  }

  query += ` ORDER BY display_order ASC, display_name ASC`;

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(query, params, agencyId);

  res.json({ certificateTypes: result.rows });
}, 'fetch certificate types');

// Get single certificate type
exports.getById = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query('SELECT * FROM certificate_types WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);
  const type = result.rows[0];

  if (!type) {
    return res.status(404).json({ error: 'Certificate type not found' });
  }

  res.json({ certificateType: type });
}, 'fetch certificate type');

// Create new certificate type
exports.create = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const {
    name, display_name, display_order,
    type, has_expiry, default_validity_months
  } = req.body;

  // Validation
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Validate type
  const validType = type && ['property', 'agency', 'tenancy'].includes(type) ? type : 'property';

  // Check if name already exists within the same type
  // Defense-in-depth: explicit agency_id filtering
  const existingResult = await db.query(
    'SELECT id FROM certificate_types WHERE name = $1 AND agency_id = $2 AND type = $3',
    [name, agencyId, validType], agencyId
  );
  if (existingResult.rows[0]) {
    return res.status(400).json({ error: 'A certificate type with this name already exists' });
  }

  const insertResult = await db.query(`
    INSERT INTO certificate_types (
      agency_id, name, display_name, display_order,
      is_active, type, has_expiry, default_validity_months
    )
    VALUES ($1, $2, $3, $4, true, $5, $6, $7)
    RETURNING *
  `, [
    agencyId,
    name,
    display_name || name,
    display_order || 0,
    validType,
    has_expiry !== undefined ? has_expiry : true,
    default_validity_months || 12
  ], agencyId);

  const newType = insertResult.rows[0];

  // Only create reminder threshold for property certificate types
  if (validType === 'property') {
    // Defense-in-depth: explicit agency_id filtering
    const maxOrderResult = await db.query(
      'SELECT MAX(display_order) as max_order FROM reminder_thresholds WHERE agency_id = $1',
      [agencyId], agencyId
    );
    const newDisplayOrder = (maxOrderResult.rows[0]?.max_order || 0) + 1;

    await db.query(`
      INSERT INTO reminder_thresholds (certificate_type, display_name, critical_days, medium_days, low_days, enabled, display_order)
      VALUES ($1, $2, 3, 7, 30, true, $3)
    `, [name, display_name || name, newDisplayOrder], agencyId);
  }

  res.status(201).json({
    message: 'Certificate type created successfully',
    certificateType: newType
  });
}, 'create certificate type');

// Update certificate type
exports.update = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  const {
    name, display_name, display_order, is_active,
    has_expiry, default_validity_months
  } = req.body;

  // Check if exists
  // Defense-in-depth: explicit agency_id filtering
  const existingResult = await db.query(
    'SELECT * FROM certificate_types WHERE id = $1 AND agency_id = $2',
    [id, agencyId], agencyId
  );
  const existing = existingResult.rows[0];
  if (!existing) {
    return res.status(404).json({ error: 'Certificate type not found' });
  }

  // Check if name is being changed and conflicts with another type
  if (name && name !== existing.name) {
    // Defense-in-depth: explicit agency_id filtering
    const duplicateResult = await db.query(
      'SELECT id FROM certificate_types WHERE name = $1 AND id != $2 AND agency_id = $3 AND type = $4',
      [name, id, agencyId, existing.type], agencyId
    );
    if (duplicateResult.rows[0]) {
      return res.status(400).json({ error: 'A certificate type with this name already exists' });
    }
  }

  const updatedName = name || existing.name;
  const updatedDisplayName = display_name || existing.display_name;

  // Defense-in-depth: explicit agency_id filtering
  const updateResult = await db.query(`
    UPDATE certificate_types
    SET name = $1,
        display_name = $2,
        display_order = $3,
        is_active = $4,
        has_expiry = $5,
        default_validity_months = $6,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $7 AND agency_id = $8
    RETURNING *
  `, [
    updatedName,
    updatedDisplayName,
    display_order !== undefined ? display_order : existing.display_order,
    is_active !== undefined ? is_active : existing.is_active,
    has_expiry !== undefined ? has_expiry : existing.has_expiry,
    default_validity_months !== undefined ? default_validity_months : existing.default_validity_months,
    id,
    agencyId
  ], agencyId);

  const updated = updateResult.rows[0];

  // Only update reminder thresholds for property certificate types
  if (existing.type === 'property' && (name !== undefined || display_name !== undefined)) {
    // Defense-in-depth: explicit agency_id filtering
    await db.query(`
      UPDATE reminder_thresholds
      SET certificate_type = $1,
          display_name = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE certificate_type = $3 AND agency_id = $4
    `, [updatedName, updatedDisplayName, existing.name, agencyId], agencyId);
  }

  res.json({
    message: 'Certificate type updated successfully',
    certificateType: updated
  });
}, 'update certificate type');

// Delete certificate type
exports.delete = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  // Check if exists
  // Defense-in-depth: explicit agency_id filtering
  const existingResult = await db.query(
    'SELECT * FROM certificate_types WHERE id = $1 AND agency_id = $2',
    [id, agencyId], agencyId
  );
  const existing = existingResult.rows[0];
  if (!existing) {
    return res.status(404).json({ error: 'Certificate type not found' });
  }

  // Check if any certificates are using this certificate type
  // Defense-in-depth: explicit agency_id filtering
  const usageResult = await db.query(
    'SELECT COUNT(*) as count FROM certificates WHERE certificate_type_id = $1 AND agency_id = $2',
    [id, agencyId], agencyId
  );
  const usage = usageResult.rows[0];
  if (usage && parseInt(usage.count) > 0) {
    return res.status(400).json({
      error: `Cannot delete this certificate type. It is being used by ${usage.count} certificate(s). Please delete those certificates first.`
    });
  }

  // Explicit agency_id for defense-in-depth
  await db.query('DELETE FROM certificate_types WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);

  // Only delete reminder threshold for property certificate types
  if (existing.type === 'property') {
    await db.query(
      'DELETE FROM reminder_thresholds WHERE certificate_type = $1 AND agency_id = $2',
      [existing.name, agencyId], agencyId
    );
  }

  res.json({ message: 'Certificate type deleted successfully' });
}, 'delete certificate type');

// Reorder certificate types
exports.reorder = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { order } = req.body; // Array of {id, display_order}

  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'Order must be an array' });
  }

  await db.transaction(async (client) => {
    for (const item of order) {
      // Defense-in-depth: explicit agency_id filtering
      await client.query(
        'UPDATE certificate_types SET display_order = $1 WHERE id = $2 AND agency_id = $3',
        [item.display_order, item.id, agencyId]
      );
    }
  }, agencyId);

  res.json({ message: 'Certificate types reordered successfully' });
}, 'reorder certificate types');
