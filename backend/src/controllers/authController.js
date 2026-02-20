/**
 * Authentication Controller
 *
 * Handles user authentication with multi-tenancy support.
 * JWT tokens include agency_id for RLS enforcement.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { getAgencyBySlug } = require('../middleware/agencyContext');
const asyncHandler = require('../utils/asyncHandler');
const { validateRequiredFields, validateEmail, validatePassword } = require('../utils/validators');
const { buildAgencyUrl } = require('../utils/urlBuilder');

/**
 * Generate JWT token with agency context
 * @param {object} user - User object with id, email, role
 * @param {number} agencyId - Agency ID to include in token
 * @returns {string} JWT token
 */
const generateToken = (user, agencyId) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      agency_id: agencyId
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

/**
 * Generate a readable temporary password
 */
const generateReadablePassword = () => {
  const adjectives = ['Blue', 'Green', 'Red', 'Happy', 'Swift', 'Calm'];
  const nouns = ['River', 'Mountain', 'Forest', 'Ocean', 'Sky', 'Storm'];
  const numbers = Math.floor(Math.random() * 900) + 100;
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}${noun}${numbers}`;
};

/**
 * Register new user (tenant self-registration)
 *
 * POST /api/auth/register
 * Body: { email, password, first_name, last_name, phone }
 */
exports.register = asyncHandler(async (req, res) => {
  const { email, password, first_name, last_name, phone } = req.body;
  const agencyId = req.agencyId;

  // Validation
  try {
    validateRequiredFields(req.body, ['email', 'password', 'first_name', 'last_name']);
    validateEmail(email);
    validatePassword(password, { requireUppercase: false, requireLowercase: false, requireNumbers: false });
  } catch (validationError) {
    return res.status(400).json({ error: validationError.message });
  }

  if (!agencyId) {
    return res.status(400).json({ error: 'Agency context is required for registration' });
  }

  // Check if user already exists in this agency
  // Defense-in-depth: explicit agency_id filtering
  const existingResult = await db.query(
    `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND agency_id = $2`,
    [email, agencyId],
    agencyId
  );

  if (existingResult.rows.length > 0) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const insertResult = await db.query(
    `INSERT INTO users (agency_id, email, password_hash, first_name, last_name, phone, role)
     VALUES ($1, $2, $3, $4, $5, $6, 'tenant')
     RETURNING id, email, first_name, last_name, role`,
    [agencyId, email.toLowerCase(), passwordHash, first_name, last_name, phone || null],
    agencyId
  );

  const newUser = insertResult.rows[0];

  res.status(201).json({ message: 'Registration successful', user: newUser });
}, 'register user');

/**
 * Login to agency portal
 *
 * POST /api/auth/login
 * Body: { email, password, agency_slug }
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, password, agency_slug } = req.body;

  // Validation
  try {
    validateRequiredFields(req.body, ['email', 'password']);
  } catch (validationError) {
    return res.status(400).json({ error: validationError.message });
  }

  if (!agency_slug && !req.agencyId) {
    return res.status(400).json({ error: 'Agency slug is required' });
  }

  // Get agency
  let agency = req.agency;
  if (!agency && agency_slug) {
    agency = await getAgencyBySlug(agency_slug);
  }

  if (!agency) {
    return res.status(404).json({ error: 'Agency not found' });
  }

  if (!agency.is_active) {
    return res.status(403).json({ error: 'This agency account is currently inactive.' });
  }

  // Find user in this agency
  const userResult = await db.query(
    `SELECT id, email, password_hash, first_name, last_name, role
     FROM users
     WHERE LOWER(email) = LOWER($1) AND agency_id = $2`,
    [email, agency.id],
    agency.id
  );

  const user = userResult.rows[0];

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Check password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);

  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Update last login
  // Defense-in-depth: explicit agency_id filtering
  await db.query(
    `UPDATE users SET last_login_at = NOW() WHERE id = $1 AND agency_id = $2`,
    [user.id, agency.id],
    agency.id
  );

  // Generate token with agency context
  const token = generateToken(user, agency.id);

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role
    },
    agency: {
      id: agency.id,
      name: agency.name,
      slug: agency.slug,
      logo_url: agency.logo_url,
      primary_color: agency.primary_color
    }
  });
}, 'login');

/**
 * Get current authenticated user
 *
 * GET /api/auth/me
 */
exports.getCurrentUser = asyncHandler(async (req, res) => {
  // Defense-in-depth: explicit agency_id filtering
  const userResult = await db.query(
    `SELECT id, email, first_name, last_name, phone, role
     FROM users WHERE id = $1 AND agency_id = $2`,
    [req.user.id, req.agencyId],
    req.agencyId
  );

  const user = userResult.rows[0];

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user, agency: req.agency });
}, 'fetch user');

/**
 * Forgot password - Request password reset
 *
 * POST /api/auth/forgot-password
 * Body: { email, agency_slug }
 */
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email, agency_slug } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Always return success to not reveal if email exists
  const successMessage = 'If an account exists with that email, you will receive a password reset link.';

  // Get agency
  let agency = req.agency;
  if (!agency && agency_slug) {
    agency = await getAgencyBySlug(agency_slug);
  }

  if (!agency) {
    return res.json({ message: successMessage });
  }

  // Find user
  const userResult = await db.query(
    `SELECT id, email, first_name FROM users
     WHERE LOWER(email) = LOWER($1) AND agency_id = $2`,
    [email, agency.id],
    agency.id
  );

  const user = userResult.rows[0];

  if (!user) {
    return res.json({ message: successMessage });
  }

  // Generate reset token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Store token
  // Defense-in-depth: explicit agency_id filtering
  await db.query(
    `UPDATE users SET password_reset_token = $1, password_reset_expires = $2
     WHERE id = $3 AND agency_id = $4`,
    [token, expiresAt.toISOString(), user.id, agency.id],
    agency.id
  );

  // Generate reset URL
  const resetUrl = buildAgencyUrl(agency.slug, `reset-password?token=${token}`);

  // TODO: Queue password reset email with agency branding
  console.log(`Password reset URL for ${user.email}: ${resetUrl}`);

  res.json({ message: successMessage });
}, 'process password reset request');

/**
 * Reset password with token
 *
 * POST /api/auth/reset-password
 * Body: { token, password }
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  try {
    validateRequiredFields(req.body, ['token', 'password']);
    validatePassword(password, { requireUppercase: false, requireLowercase: false, requireNumbers: false });
  } catch (validationError) {
    return res.status(400).json({ error: validationError.message });
  }

  // Find user with valid token (bypass RLS for this lookup)
  const userResult = await db.systemQuery(
    `SELECT id, agency_id, email, first_name
     FROM users
     WHERE password_reset_token = $1
       AND password_reset_expires > NOW()`,
    [token]
  );

  const user = userResult.rows[0];

  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(password, 10);

  // Update password and clear token
  // Defense-in-depth: explicit agency_id filtering
  await db.query(
    `UPDATE users
     SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL
     WHERE id = $2 AND agency_id = $3`,
    [passwordHash, user.id, user.agency_id],
    user.agency_id
  );

  res.json({ message: 'Password reset successful. You can now log in.' });
}, 'reset password');

/**
 * Change password (for logged-in users)
 *
 * POST /api/auth/change-password
 * Body: { currentPassword, newPassword }
 */
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  try {
    validateRequiredFields(req.body, ['currentPassword', 'newPassword']);
    validatePassword(newPassword, { requireUppercase: false, requireLowercase: false, requireNumbers: false });
  } catch (validationError) {
    return res.status(400).json({ error: validationError.message });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'New password must be different' });
  }

  // Get current password hash
  // Defense-in-depth: explicit agency_id filtering
  const userResult = await db.query(
    `SELECT password_hash FROM users WHERE id = $1 AND agency_id = $2`,
    [userId, req.agencyId],
    req.agencyId
  );

  const user = userResult.rows[0];

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  // Hash and update new password
  const passwordHash = await bcrypt.hash(newPassword, 10);

  // Defense-in-depth: explicit agency_id filtering
  await db.query(
    `UPDATE users SET password_hash = $1 WHERE id = $2 AND agency_id = $3`,
    [passwordHash, userId, req.agencyId],
    req.agencyId
  );

  res.json({ message: 'Password changed successfully' });
}, 'change password');

/**
 * Validate setup token (for new accounts)
 *
 * GET /api/auth/setup/:token
 */
exports.validateSetupToken = asyncHandler(async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ error: 'Setup token is required' });
  }

  // Find user with token (bypass RLS)
  const userResult = await db.systemQuery(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.setup_token_expires, a.slug as agency_slug
     FROM users u
     JOIN agencies a ON u.agency_id = a.id
     WHERE u.setup_token = $1`,
    [token]
  );

  const user = userResult.rows[0];

  if (!user) {
    return res.status(404).json({ error: 'Setup link not found' });
  }

  if (user.setup_token_expires && new Date(user.setup_token_expires) < new Date()) {
    return res.status(400).json({ error: 'Setup link has expired' });
  }

  res.json({
    user: {
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name
    },
    agency_slug: user.agency_slug
  });
}, 'validate setup link');

/**
 * Set password using setup token
 *
 * POST /api/auth/setup/:token
 * Body: { password }
 */
exports.setPasswordWithToken = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    validateRequiredFields(req.body, ['password']);
    validatePassword(password, { requireUppercase: false, requireLowercase: false, requireNumbers: false });
  } catch (validationError) {
    return res.status(400).json({ error: validationError.message });
  }

  // Find user with token (bypass RLS)
  const userResult = await db.systemQuery(
    `SELECT id, agency_id, setup_token_expires
     FROM users WHERE setup_token = $1`,
    [token]
  );

  const user = userResult.rows[0];

  if (!user) {
    return res.status(404).json({ error: 'Setup link not found' });
  }

  if (user.setup_token_expires && new Date(user.setup_token_expires) < new Date()) {
    return res.status(400).json({ error: 'Setup link has expired' });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Update user
  // Defense-in-depth: explicit agency_id filtering
  await db.query(
    `UPDATE users
     SET password_hash = $1, setup_token = NULL, setup_token_expires = NULL, email_verified = true
     WHERE id = $2 AND agency_id = $3`,
    [passwordHash, user.id, user.agency_id],
    user.agency_id
  );

  // Fetch user for JWT
  const fullUserResult = await db.query(
    `SELECT id, email, first_name, last_name, role FROM users WHERE id = $1 AND agency_id = $2`,
    [user.id, user.agency_id],
    user.agency_id
  );
  const fullUser = fullUserResult.rows[0];

  // Fetch agency for response
  const agencyResult = await db.query(
    `SELECT id, name, slug, logo_url, primary_color FROM agencies WHERE id = $1`,
    [user.agency_id],
    user.agency_id
  );
  const agency = agencyResult.rows[0];

  // Generate JWT
  const jwtToken = generateToken(fullUser, user.agency_id);

  // Update last_login_at
  await db.query(
    `UPDATE users SET last_login_at = NOW() WHERE id = $1 AND agency_id = $2`,
    [user.id, user.agency_id],
    user.agency_id
  );

  res.json({
    message: 'Password set successfully.',
    token: jwtToken,
    user: {
      id: fullUser.id,
      email: fullUser.email,
      first_name: fullUser.first_name,
      last_name: fullUser.last_name,
      role: fullUser.role
    },
    agency: agency ? {
      id: agency.id,
      name: agency.name,
      slug: agency.slug,
      logo_url: agency.logo_url,
      primary_color: agency.primary_color
    } : null
  });
}, 'set password');

/**
 * Admin: Create user account
 *
 * POST /api/admin/users
 * Body: { email, first_name, last_name, phone, role }
 */
exports.adminCreateUser = asyncHandler(async (req, res) => {
  const { email, first_name, last_name, phone, role = 'tenant' } = req.body;
  const agencyId = req.agencyId;

  // Validation
  try {
    validateRequiredFields(req.body, ['email', 'first_name', 'last_name']);
    validateEmail(email);
  } catch (validationError) {
    return res.status(400).json({ error: validationError.message });
  }

  const validRoles = ['admin', 'tenant', 'landlord'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // Check if user already exists in this agency
  // Defense-in-depth: explicit agency_id filtering
  const existingResult = await db.query(
    `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND agency_id = $2`,
    [email, agencyId],
    agencyId
  );

  if (existingResult.rows.length > 0) {
    return res.status(400).json({ error: 'Email already registered in this agency' });
  }

  const setupToken = crypto.randomBytes(32).toString('hex');
  const setupTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Create user
  const insertResult = await db.query(
    `INSERT INTO users (agency_id, email, password_hash, first_name, last_name, phone, role, setup_token, setup_token_expires)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, email, first_name, last_name, role`,
    [agencyId, email.toLowerCase(), null, first_name, last_name, phone || null, role, setupToken, setupTokenExpires],
    agencyId
  );

  const newUser = insertResult.rows[0];

  res.status(201).json({
    message: 'User created. Setup email will be sent.',
    user: newUser
  });
}, 'create user');

/**
 * Admin: Get all users
 *
 * GET /api/admin/users
 * Query: { search, role, excludeAdmins }
 */
exports.adminGetUsers = asyncHandler(async (req, res) => {
  const { search, role, excludeAdmins } = req.query;
  const agencyId = req.agencyId;

  let query = `
    SELECT id, email, first_name, last_name, phone, role, created_at
    FROM users
    WHERE agency_id = $1
  `;
  const params = [agencyId];
  let paramIndex = 2;

  // Defense-in-depth: explicit agency_id filtering
  if (excludeAdmins === 'true') {
    query += ` AND role != 'admin'`;
  }

  if (role) {
    query += ` AND role = $${paramIndex++}`;
    params.push(role);
  }

  if (search) {
    query += ` AND (
      email ILIKE $${paramIndex} OR
      first_name ILIKE $${paramIndex} OR
      last_name ILIKE $${paramIndex} OR
      CONCAT(first_name, ' ', last_name) ILIKE $${paramIndex}
    )`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  query += ` ORDER BY first_name, last_name LIMIT 100`;

  const result = await db.query(query, params, agencyId);

  res.json({ users: result.rows });
}, 'fetch users');

/**
 * Admin: Get single user
 *
 * GET /api/admin/users/:id
 */
exports.adminGetUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(
    `SELECT id, email, first_name, last_name, phone, role, created_at, last_login_at
     FROM users WHERE id = $1 AND agency_id = $2`,
    [id, req.agencyId],
    req.agencyId
  );

  const user = result.rows[0];

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user });
}, 'fetch user');

/**
 * Admin: Update user
 *
 * PUT /api/admin/users/:id
 * Note: Role cannot be changed after creation.
 */
exports.adminUpdateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { email, first_name, last_name, phone } = req.body;

  // Check user exists
  // Defense-in-depth: explicit agency_id filtering
  const existingResult = await db.query(
    `SELECT id, email FROM users WHERE id = $1 AND agency_id = $2`,
    [id, req.agencyId],
    req.agencyId
  );

  if (existingResult.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Build update query
  const updates = [];
  const params = [];
  let paramIndex = 1;

  if (email !== undefined) {
    updates.push(`email = $${paramIndex++}`);
    params.push(email.toLowerCase());
  }
  if (first_name !== undefined) {
    updates.push(`first_name = $${paramIndex++}`);
    params.push(first_name);
  }
  if (last_name !== undefined) {
    updates.push(`last_name = $${paramIndex++}`);
    params.push(last_name);
  }
  if (phone !== undefined) {
    updates.push(`phone = $${paramIndex++}`);
    params.push(phone || null);
  }
  updates.push(`updated_at = NOW()`);

  if (updates.length === 1) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  params.push(id);
  params.push(req.agencyId);

  // Defense-in-depth: explicit agency_id filtering
  await db.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} AND agency_id = $${paramIndex + 1}`,
    params,
    req.agencyId
  );

  res.json({ message: 'User updated' });
}, 'update user');

/**
 * Update own account
 *
 * PUT /api/auth/me
 */
exports.updateMyAccount = asyncHandler(async (req, res) => {
  const { first_name, last_name, phone } = req.body;
  const userId = req.user.id;

  try {
    validateRequiredFields(req.body, ['first_name', 'last_name']);
  } catch (validationError) {
    return res.status(400).json({ error: validationError.message });
  }

  // Defense-in-depth: explicit agency_id filtering
  await db.query(
    `UPDATE users SET first_name = $1, last_name = $2, phone = $3, updated_at = NOW()
     WHERE id = $4 AND agency_id = $5`,
    [first_name, last_name, phone || null, userId, req.agencyId],
    req.agencyId
  );

  // Defense-in-depth: explicit agency_id filtering
  const result = await db.query(
    `SELECT id, email, first_name, last_name, phone, role FROM users WHERE id = $1 AND agency_id = $2`,
    [userId, req.agencyId],
    req.agencyId
  );

  res.json({ message: 'Account updated', user: result.rows[0] });
}, 'update account');

/**
 * Admin: Reset user password
 *
 * POST /api/admin/users/:id/reset-password
 * Body: { send_email }
 */
exports.adminResetPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { send_email = true } = req.body;
  const agencyId = req.agencyId;

  // Check user exists
  // Defense-in-depth: explicit agency_id filtering
  const userResult = await db.query(
    `SELECT id, email, first_name FROM users WHERE id = $1 AND agency_id = $2`,
    [id, agencyId],
    agencyId
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = userResult.rows[0];
  let temporaryPassword = null;
  let setupToken = null;
  let setupTokenExpires = null;

  if (send_email) {
    // Generate setup token for email reset
    setupToken = crypto.randomBytes(32).toString('hex');
    setupTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Defense-in-depth: explicit agency_id filtering
    await db.query(
      `UPDATE users SET setup_token = $1, setup_token_expires = $2 WHERE id = $3 AND agency_id = $4`,
      [setupToken, setupTokenExpires, id, agencyId],
      agencyId
    );

    // TODO: Queue password reset email
  } else {
    // Generate temporary password
    temporaryPassword = generateReadablePassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    // Defense-in-depth: explicit agency_id filtering
    await db.query(
      `UPDATE users SET password_hash = $1, setup_token = NULL, setup_token_expires = NULL WHERE id = $2 AND agency_id = $3`,
      [passwordHash, id, agencyId],
      agencyId
    );
  }

  const responseData = {
    message: send_email
      ? 'Password reset email sent'
      : 'Password reset. Temporary password generated.'
  };

  if (temporaryPassword) {
    responseData.temporaryPassword = temporaryPassword;
  }

  res.json(responseData);
}, 'reset password');

/**
 * Admin: Delete user
 *
 * DELETE /api/admin/users/:id
 * Hard deletes the user if they have no linked tenancies, applications, or maintenance requests.
 */
exports.adminDeleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const agencyId = req.agencyId;

  // Check user exists
  // Defense-in-depth: explicit agency_id filtering
  const userResult = await db.query(
    `SELECT id, role, email FROM users WHERE id = $1 AND agency_id = $2`,
    [id, agencyId],
    agencyId
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = userResult.rows[0];

  // Prevent deleting yourself
  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  // Prevent deleting landlord users directly — must delete via Landlords section
  if (user.role === 'landlord') {
    return res.status(400).json({ error: 'Landlord users cannot be deleted from here. Remove the landlord from the Landlords section instead.' });
  }

  // Check for linked records
  const linkedRecords = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM tenancy_members WHERE user_id = $1) as tenancy_count,
      (SELECT COUNT(*) FROM applications WHERE user_id = $1) as application_count,
      (SELECT COUNT(*) FROM maintenance_requests WHERE created_by_user_id = $1) as maintenance_count
  `, [id], agencyId);

  const counts = linkedRecords.rows[0];
  const hasLinkedRecords =
    parseInt(counts.tenancy_count) > 0 ||
    parseInt(counts.application_count) > 0 ||
    parseInt(counts.maintenance_count) > 0;

  if (hasLinkedRecords) {
    return res.status(400).json({
      error: 'Cannot delete this user because they have linked records.',
      linked_records: {
        tenancies: parseInt(counts.tenancy_count),
        applications: parseInt(counts.application_count),
        maintenance_requests: parseInt(counts.maintenance_count),
      }
    });
  }

  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
  console.log(`[AUDIT] User ${id} (${user.email}) deleted by admin ${req.user.id}:`, {
    ip: clientIp,
    agencyId,
    timestamp: new Date().toISOString()
  });

  // Defense-in-depth: explicit agency_id filtering
  await db.query(
    `DELETE FROM users WHERE id = $1 AND agency_id = $2`,
    [id, agencyId],
    agencyId
  );

  res.json({ message: 'User deleted' });
}, 'delete user');

module.exports = exports;
