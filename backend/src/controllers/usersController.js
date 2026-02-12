const db = require('../db');
const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');

// Get all users (admin only)
exports.getAllUsers = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(`
    SELECT id, email, first_name, last_name, phone, role, created_at
    FROM users
    WHERE agency_id = $1
    ORDER BY created_at DESC
  `, [agencyId], agencyId);

  res.json({ users: result.rows });
}, 'fetch users');

// Get single user by ID (admin only)
exports.getUserById = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id} = req.params;

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(`
    SELECT id, email, first_name, last_name, phone, role, created_at
    FROM users
    WHERE id = $1 AND agency_id = $2
  `, [id, agencyId], agencyId);

  const user = result.rows[0];

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user });
}, 'fetch user');

// Lookup user by email (admin only) - for email-first user selection
exports.lookupByEmail = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(`
    SELECT id, email, first_name, last_name, phone, role, created_at
    FROM users
    WHERE LOWER(email) = LOWER($1) AND agency_id = $2
  `, [email, agencyId], agencyId);

  const user = result.rows[0];

  if (!user) {
    return res.json({ exists: false, user: null });
  }

  res.json({ exists: true, user });
}, 'look up user');

// Update user (admin only)
exports.updateUser = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;
  const { email, first_name, last_name, phone, password } = req.body;

  // Validation
  if (!email || !first_name || !last_name) {
    return res.status(400).json({ error: 'Email, first name, and last name are required' });
  }

  // Check if user exists - defense-in-depth: explicit agency_id filtering
  const userResult = await db.query('SELECT id FROM users WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);
  const user = userResult.rows[0];

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Check if email is already taken by another user - defense-in-depth: explicit agency_id filtering
  const existingUserResult = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2 AND agency_id = $3', [email, id, agencyId], agencyId);
  const existingUser = existingUserResult.rows[0];

  if (existingUser) {
    return res.status(400).json({ error: 'Email already taken' });
  }

  // Prepare update query - defense-in-depth: explicit agency_id in WHERE clause
  let updateQuery = `
    UPDATE users
    SET email = $1, first_name = $2, last_name = $3, phone = $4, updated_at = CURRENT_TIMESTAMP
    WHERE id = $5 AND agency_id = $6
    RETURNING *
  `;
  let params = [email, first_name, last_name, phone || null, id, agencyId];

  // If password is provided, update it too
  if (password && password.trim().length > 0) {
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const password_hash = bcrypt.hashSync(password, 10);
    updateQuery = `
      UPDATE users
      SET email = $1, password_hash = $2, first_name = $3, last_name = $4, phone = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND agency_id = $7
      RETURNING *
    `;
    params = [email, password_hash, first_name, last_name, phone || null, id, agencyId];
  }

  // Update user
  await db.query(updateQuery, params, agencyId);

  res.json({ message: 'User updated successfully' });
}, 'update user');

// Delete user (admin only)
exports.deleteUser = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { id } = req.params;

  // Prevent deleting yourself
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  // Check if user exists - defense-in-depth: explicit agency_id filtering
  const userResult = await db.query('SELECT id FROM users WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);
  const user = userResult.rows[0];

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Delete user (explicit agency_id for defense-in-depth)
  await db.query('DELETE FROM users WHERE id = $1 AND agency_id = $2', [id, agencyId], agencyId);

  res.json({ message: 'User deleted successfully' });
}, 'delete user');

// Bulk delete users (admin only)
exports.bulkDeleteUsers = asyncHandler(async (req, res) => {
  const agencyId = req.agencyId;
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }

  // Filter out the current user's ID to prevent self-deletion
  const idsToDelete = ids.filter(id => parseInt(id) !== req.user.id);

  if (idsToDelete.length === 0) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const placeholders = idsToDelete.map((_, index) => `$${index + 1}`).join(',');
  const result = await db.query(
    `DELETE FROM users WHERE id IN (${placeholders}) AND agency_id = $${idsToDelete.length + 1} RETURNING *`,
    [...idsToDelete, agencyId],
    agencyId
  );

  res.json({ message: `${result.rows.length} user(s) deleted successfully`, deleted: result.rows.length });
}, 'delete users');
