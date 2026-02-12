const db = require('../db');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Update tenancy member (room assignment, rent, deposit)
 * PUT /api/tenancies/:id/members/:memberId
 */
exports.updateTenancyMember = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id, memberId } = req.params;
  const { bedroom_id, rent_pppw, deposit_amount } = req.body;

  // Validate inputs
  if (rent_pppw !== undefined && (isNaN(rent_pppw) || rent_pppw < 0)) {
    return res.status(400).json({ error: 'Invalid rent amount' });
  }
  if (deposit_amount !== undefined && (isNaN(deposit_amount) || deposit_amount < 0)) {
    return res.status(400).json({ error: 'Invalid deposit amount' });
  }

  // Check if member exists and belongs to this tenancy, and get tenancy status
  // Defense-in-depth: explicit agency_id filtering
  const memberResult = await db.query(`
    SELECT tm.*, t.property_id, t.status
    FROM tenancy_members tm
    INNER JOIN tenancies t ON tm.tenancy_id = t.id
    WHERE tm.id = $1 AND tm.tenancy_id = $2 AND tm.agency_id = $3
  `, [memberId, id, agencyId], agencyId);
  const member = memberResult.rows[0];

  if (!member) {
    return res.status(404).json({ error: 'Tenant in this tenancy not found' });
  }

  // Only allow editing if tenancy status is 'pending'
  if (member.status !== 'pending') {
    return res.status(403).json({ error: 'Cannot edit tenant details after tenancy has been checked. Only pending tenancies can be modified.' });
  }

  // If bedroom_id is provided, validate it belongs to the property
  if (bedroom_id !== undefined && bedroom_id !== null) {
    // Defense-in-depth: explicit agency_id filtering
    const bedroomResult = await db.query(`
      SELECT id FROM bedrooms WHERE id = $1 AND property_id = $2 AND agency_id = $3
    `, [bedroom_id, member.property_id, agencyId], agencyId);

    if (bedroomResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid bedroom for this property' });
    }

    // Check if bedroom is already assigned to another member in this tenancy
    // Defense-in-depth: explicit agency_id filtering
    const existingAssignmentResult = await db.query(`
      SELECT id FROM tenancy_members
      WHERE tenancy_id = $1 AND bedroom_id = $2 AND id != $3 AND agency_id = $4
    `, [id, bedroom_id, memberId, agencyId], agencyId);

    if (existingAssignmentResult.rows.length > 0) {
      return res.status(400).json({ error: 'Bedroom is already assigned to another tenant in this tenancy' });
    }
  }

  // Build update query dynamically
  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (bedroom_id !== undefined) {
    updates.push(`bedroom_id = $${paramIndex++}`);
    values.push(bedroom_id || null); // Allow null to unassign bedroom
  }
  if (rent_pppw !== undefined) {
    updates.push(`rent_pppw = $${paramIndex++}`);
    values.push(rent_pppw);
  }
  if (deposit_amount !== undefined) {
    updates.push(`deposit_amount = $${paramIndex++}`);
    values.push(deposit_amount);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(memberId, agencyId);

  // Defense-in-depth: explicit agency_id filtering
  await db.query(`
    UPDATE tenancy_members
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex} AND agency_id = $${paramIndex + 1}
  `, values, agencyId);

  // Return updated member with joined data
  // Defense-in-depth: explicit agency_id filtering
  const updatedMemberResult = await db.query(`
    SELECT tm.*,
      a.user_id, a.application_type,
      u.first_name, u.last_name, u.email, u.phone,
      b.bedroom_name
    FROM tenancy_members tm
    LEFT JOIN applications a ON tm.application_id = a.id
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN bedrooms b ON tm.bedroom_id = b.id
    WHERE tm.id = $1 AND tm.agency_id = $2
  `, [memberId, agencyId], agencyId);

  res.json({ member: updatedMemberResult.rows[0] });
}, 'update tenant information');

/**
 * Update key tracking information for a tenant (member)
 * PUT /api/tenancies/:id/members/:memberId/key-tracking
 *
 * NOTE: The tenancy_members table does not have key_status, key_collection_date,
 * or key_return_date columns. This endpoint is kept for API compatibility but
 * returns an error.
 */
exports.updateMemberKeyTracking = asyncHandler(async (req, res) => {
  return res.status(400).json({
    error: 'Key tracking columns (key_status, key_collection_date, key_return_date) are not available on the tenancy_members table. This feature requires a schema migration.'
  });
}, 'update key tracking information');
