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
 * Update key tracking for a tenancy member
 * PUT /api/tenancies/:id/members/:memberId/key-tracking
 */
exports.updateMemberKeyTracking = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id: tenancyId, memberId } = req.params;
  const { key_status, key_collection_date, key_return_date } = req.body;

  const validStatuses = ['not_collected', 'collected', 'returned'];
  if (!key_status || !validStatuses.includes(key_status)) {
    return res.status(400).json({ error: 'Invalid key_status. Must be one of: not_collected, collected, returned' });
  }

  // Enforce date invariants based on status
  let effectiveCollectionDate = key_collection_date || null;
  let effectiveReturnDate = key_return_date || null;

  if (key_status === 'not_collected') {
    // Clear both dates when resetting to not_collected
    effectiveCollectionDate = null;
    effectiveReturnDate = null;
  } else if (key_status === 'collected') {
    if (!effectiveCollectionDate) {
      return res.status(400).json({ error: 'key_collection_date is required when key_status is collected' });
    }
    effectiveReturnDate = null; // Cannot have return date without being returned
  } else if (key_status === 'returned') {
    if (!effectiveReturnDate) {
      return res.status(400).json({ error: 'key_return_date is required when key_status is returned' });
    }
  }

  // Verify member belongs to this tenancy
  const memberResult = await db.query(
    `SELECT tm.id FROM tenancy_members tm WHERE tm.id = $1 AND tm.tenancy_id = $2 AND tm.agency_id = $3`,
    [memberId, tenancyId, agencyId], agencyId
  );
  if (memberResult.rows.length === 0) {
    return res.status(404).json({ error: 'Tenancy member not found' });
  }

  // Update key tracking
  await db.query(
    `UPDATE tenancy_members
     SET key_status = $1, key_collection_date = $2, key_return_date = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4 AND agency_id = $5 AND tenancy_id = $6`,
    [key_status, effectiveCollectionDate, effectiveReturnDate, memberId, agencyId, tenancyId], agencyId
  );

  // Check if all members have returned keys
  const allMembersResult = await db.query(
    `SELECT id, key_status FROM tenancy_members WHERE tenancy_id = $1 AND agency_id = $2`,
    [tenancyId, agencyId], agencyId
  );
  const allMembersReturnedKeys = allMembersResult.rows.every(m => m.key_status === 'returned');

  // Check if deposit return schedules already exist
  let canCreateDepositReturns = false;
  let latestKeyReturnDate = null;
  if (allMembersReturnedKeys) {
    const existingDepositsResult = await db.query(
      `SELECT COUNT(*) as count FROM payment_schedules ps
       INNER JOIN tenancy_members tm ON ps.tenancy_member_id = tm.id
       WHERE tm.tenancy_id = $1 AND ps.payment_type = 'deposit_return' AND ps.agency_id = $2`,
      [tenancyId, agencyId], agencyId
    );
    canCreateDepositReturns = parseInt(existingDepositsResult.rows[0].count) === 0;

    const latestDateResult = await db.query(
      `SELECT MAX(key_return_date) as latest FROM tenancy_members WHERE tenancy_id = $1 AND agency_id = $2`,
      [tenancyId, agencyId], agencyId
    );
    latestKeyReturnDate = latestDateResult.rows[0]?.latest;
  }

  res.json({
    success: true,
    allMembersReturnedKeys,
    canCreateDepositReturns,
    latestKeyReturnDate,
  });
}, 'update key tracking information');
