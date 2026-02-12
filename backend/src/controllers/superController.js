/**
 * Super Admin Controller
 *
 * Handles authentication and operations for Letably platform staff.
 * All operations are platform-wide, not scoped to any agency.
 */

const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateSuperToken, logAuditAction, getClientIp } = require('../middleware/superAuth');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Super admin login
 *
 * POST /api/super/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Find super user by email
  const result = await db.systemQuery(
    `SELECT id, email, password_hash, first_name, last_name, role, is_active
     FROM super_users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const superUser = result.rows[0];

  if (!superUser.is_active) {
    return res.status(401).json({ error: 'Account is disabled' });
  }

  // Verify password
  const isValid = await bcrypt.compare(password, superUser.password_hash);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Update last login
  await db.systemQuery(
    `UPDATE super_users SET last_login_at = NOW() WHERE id = $1`,
    [superUser.id]
  );

  // Generate token
  const token = generateSuperToken(superUser);

  // Log the login
  await logAuditAction(
    superUser.id,
    'login',
    null,
    null,
    { email: superUser.email },
    getClientIp(req)
  );

  res.json({
    token,
    user: {
      id: superUser.id,
      email: superUser.email,
      first_name: superUser.first_name,
      last_name: superUser.last_name,
      role: superUser.role
    }
  });
}, 'super admin login');

/**
 * Get current super user
 *
 * GET /api/super/auth/me
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  const result = await db.systemQuery(
    `SELECT id, email, first_name, last_name, role, last_login_at, created_at
     FROM super_users WHERE id = $1`,
    [req.superUser.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user: result.rows[0] });
}, 'get current super user');

/**
 * List all agencies with stats
 *
 * GET /api/super/agencies
 */
const listAgencies = asyncHandler(async (req, res) => {
  const { search, status, subscription_tier } = req.query;

  let query = `
    SELECT
      a.id,
      a.name,
      a.slug,
      a.email,
      a.phone,
      a.logo_url,
      a.primary_color,
      a.subscription_tier,
      a.subscription_expires_at,
      a.is_active,
      a.property_images_enabled,
      a.created_at,
      a.updated_at,
      (SELECT COUNT(*) FROM users u WHERE u.agency_id = a.id) as user_count,
      (SELECT COUNT(*) FROM users u WHERE u.agency_id = a.id AND u.role = 'admin') as admin_count,
      (SELECT COUNT(*) FROM properties p WHERE p.agency_id = a.id) as property_count,
      (SELECT COUNT(*) FROM tenancies t WHERE t.agency_id = a.id AND t.status IN ('active', 'rolling_monthly')) as active_tenancy_count,
      (
        SELECT COALESCE(SUM(file_size), 0) FROM images WHERE agency_id = a.id
      ) + (
        SELECT COALESCE(SUM(file_size), 0) FROM certificates WHERE agency_id = a.id
      ) + (
        SELECT COALESCE(SUM(file_size), 0) FROM maintenance_attachments WHERE agency_id = a.id
      ) + (
        SELECT COALESCE(SUM(file_size), 0) FROM id_documents WHERE agency_id = a.id
      ) + (
        SELECT COALESCE(SUM(file_size), 0) FROM export_jobs WHERE agency_id = a.id
      ) as total_storage_bytes
    FROM agencies a
    WHERE 1=1
  `;

  const params = [];
  let paramIndex = 1;

  if (search) {
    query += ` AND (a.name ILIKE $${paramIndex} OR a.slug ILIKE $${paramIndex} OR a.email ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (status === 'active') {
    query += ` AND a.is_active = true`;
  } else if (status === 'inactive') {
    query += ` AND a.is_active = false`;
  }

  if (subscription_tier) {
    query += ` AND a.subscription_tier = $${paramIndex}`;
    params.push(subscription_tier);
    paramIndex++;
  }

  query += ` ORDER BY a.created_at DESC`;

  const result = await db.systemQuery(query, params);

  res.json({ agencies: result.rows });
}, 'list agencies');

/**
 * Get single agency with full details
 *
 * GET /api/super/agencies/:id
 */
const getAgency = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get agency details
  const agencyResult = await db.systemQuery(
    `SELECT
      a.*,
      (SELECT COUNT(*) FROM users u WHERE u.agency_id = a.id) as user_count,
      (SELECT COUNT(*) FROM users u WHERE u.agency_id = a.id AND u.role = 'admin') as admin_count,
      (SELECT COUNT(*) FROM users u WHERE u.agency_id = a.id AND u.role = 'tenant') as tenant_count,
      (SELECT COUNT(*) FROM users u WHERE u.agency_id = a.id AND u.role = 'landlord') as landlord_count,
      (SELECT COUNT(*) FROM properties p WHERE p.agency_id = a.id) as property_count,
      (SELECT COUNT(*) FROM tenancies t WHERE t.agency_id = a.id AND t.status IN ('active', 'rolling_monthly')) as active_tenancy_count,
      (SELECT COUNT(*) FROM tenancies t WHERE t.agency_id = a.id) as total_tenancy_count
     FROM agencies a
     WHERE a.id = $1`,
    [id]
  );

  if (agencyResult.rows.length === 0) {
    return res.status(404).json({ error: 'Agency not found' });
  }

  const agency = agencyResult.rows[0];

  // Get admin users for this agency
  const adminsResult = await db.systemQuery(
    `SELECT id, email, first_name, last_name, is_active, created_at, last_login_at
     FROM users
     WHERE agency_id = $1 AND role = 'admin'
     ORDER BY created_at DESC`,
    [id]
  );

  res.json({
    agency,
    admins: adminsResult.rows
  });
}, 'get agency');

/**
 * Toggle agency active status
 *
 * PATCH /api/super/agencies/:id/status
 */
const toggleAgencyStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'is_active must be a boolean' });
  }

  const result = await db.systemQuery(
    `UPDATE agencies
     SET is_active = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, name, slug, is_active`,
    [is_active, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Agency not found' });
  }

  // Log the action
  await logAuditAction(
    req.superUser.id,
    is_active ? 'agency_enabled' : 'agency_disabled',
    'agency',
    parseInt(id),
    { agency_name: result.rows[0].name },
    getClientIp(req)
  );

  res.json({ agency: result.rows[0] });
}, 'toggle agency status');

/**
 * Update agency subscription
 *
 * PATCH /api/super/agencies/:id/subscription
 */
const updateAgencySubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { subscription_tier, subscription_expires_at } = req.body;

  const validTiers = ['standard', 'premium'];
  if (subscription_tier && !validTiers.includes(subscription_tier)) {
    return res.status(400).json({ error: 'Invalid subscription tier' });
  }

  const result = await db.systemQuery(
    `UPDATE agencies
     SET
       subscription_tier = COALESCE($1, subscription_tier),
       subscription_expires_at = $2,
       updated_at = NOW()
     WHERE id = $3
     RETURNING id, name, slug, subscription_tier, subscription_expires_at`,
    [subscription_tier, subscription_expires_at || null, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Agency not found' });
  }

  // Log the action
  await logAuditAction(
    req.superUser.id,
    'subscription_updated',
    'agency',
    parseInt(id),
    { subscription_tier, subscription_expires_at },
    getClientIp(req)
  );

  res.json({ agency: result.rows[0] });
}, 'update agency subscription');

/**
 * Get platform-wide statistics
 *
 * GET /api/super/stats
 */
const getPlatformStats = asyncHandler(async (req, res) => {
  const result = await db.systemQuery(`
    SELECT
      (SELECT COUNT(*) FROM agencies WHERE is_active = true) as active_agencies,
      (SELECT COUNT(*) FROM agencies WHERE is_active = false) as inactive_agencies,
      (SELECT COUNT(*) FROM agencies WHERE subscription_tier = 'premium') as premium_agencies,
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM users WHERE role = 'admin') as total_admins,
      (SELECT COUNT(*) FROM users WHERE role = 'tenant') as total_tenants,
      (SELECT COUNT(*) FROM users WHERE role = 'landlord') as total_landlords,
      (SELECT COUNT(*) FROM properties) as total_properties,
      (SELECT COUNT(*) FROM tenancies WHERE status IN ('active', 'rolling_monthly')) as active_tenancies,
      (SELECT COUNT(*) FROM agencies WHERE created_at > NOW() - INTERVAL '30 days') as new_agencies_30d
  `);

  res.json({ stats: result.rows[0] });
}, 'get platform stats');

/**
 * Get agency users
 *
 * GET /api/super/agencies/:id/users
 */
const getAgencyUsers = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, search } = req.query;

  let query = `
    SELECT id, email, first_name, last_name, role, is_active, created_at, last_login_at
    FROM users
    WHERE agency_id = $1
  `;

  const params = [id];
  let paramIndex = 2;

  if (role) {
    query += ` AND role = $${paramIndex}`;
    params.push(role);
    paramIndex++;
  }

  if (search) {
    query += ` AND (email ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  query += ` ORDER BY created_at DESC`;

  const result = await db.systemQuery(query, params);

  res.json({ users: result.rows });
}, 'get agency users');

/**
 * Impersonate an agency admin (generate a token for them)
 *
 * POST /api/super/agencies/:id/impersonate/:userId
 */
const impersonateUser = asyncHandler(async (req, res) => {
  const jwt = require('jsonwebtoken');

  const { id, userId } = req.params;

  // Verify the user belongs to the agency and is an admin
  const result = await db.systemQuery(
    `SELECT id, email, first_name, last_name, role, agency_id
     FROM users
     WHERE id = $1 AND agency_id = $2 AND role = 'admin' AND is_active = true`,
    [userId, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Admin user in this agency not found' });
  }

  const user = result.rows[0];

  // Generate a token for the user (normal agency token)
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      agency_id: user.agency_id,
      impersonated_by: req.superUser.id // Mark as impersonated
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' } // Short expiry for impersonation
  );

  // Log the impersonation
  await logAuditAction(
    req.superUser.id,
    'impersonate_user',
    'user',
    parseInt(userId),
    { user_email: user.email, agency_id: id },
    getClientIp(req)
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role
    },
    agency_id: user.agency_id,
    message: 'Impersonation token generated. This token expires in 1 hour.'
  });
}, 'impersonate user');

/**
 * Get audit log
 *
 * GET /api/super/audit-log
 */
const getAuditLog = asyncHandler(async (req, res) => {
  const { limit = 100, offset = 0, action, target_type } = req.query;

  let query = `
    SELECT
      al.id,
      al.action,
      al.target_type,
      al.target_id,
      al.details,
      al.ip_address,
      al.created_at,
      su.email as super_user_email,
      su.first_name as super_user_first_name,
      su.last_name as super_user_last_name
    FROM super_user_audit_log al
    LEFT JOIN super_users su ON al.super_user_id = su.id
    WHERE 1=1
  `;

  const params = [];
  let paramIndex = 1;

  if (action) {
    query += ` AND al.action = $${paramIndex}`;
    params.push(action);
    paramIndex++;
  }

  if (target_type) {
    query += ` AND al.target_type = $${paramIndex}`;
    params.push(target_type);
    paramIndex++;
  }

  query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(parseInt(limit), parseInt(offset));

  const result = await db.systemQuery(query, params);

  res.json({ audit_log: result.rows });
}, 'get audit log');

/**
 * Create a new super user (only existing super admins can do this)
 *
 * POST /api/super/users
 */
const createSuperUser = asyncHandler(async (req, res) => {
  const { email, password, first_name, last_name, role = 'super_admin' } = req.body;

  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Check if email already exists
  const existing = await db.systemQuery(
    `SELECT id FROM super_users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );

  if (existing.rows.length > 0) {
    return res.status(400).json({ error: 'Email already in use' });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const result = await db.systemQuery(
    `INSERT INTO super_users (email, password_hash, first_name, last_name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, first_name, last_name, role, created_at`,
    [email.toLowerCase().trim(), passwordHash, first_name, last_name, role]
  );

  // Log the action
  await logAuditAction(
    req.superUser.id,
    'create_super_user',
    'super_user',
    result.rows[0].id,
    { email: result.rows[0].email },
    getClientIp(req)
  );

  res.status(201).json({ user: result.rows[0] });
}, 'create super user');

/**
 * List super users
 *
 * GET /api/super/users
 */
const listSuperUsers = asyncHandler(async (req, res) => {
  const result = await db.systemQuery(
    `SELECT id, email, first_name, last_name, role, is_active, last_login_at, created_at
     FROM super_users
     ORDER BY created_at DESC`
  );

  res.json({ users: result.rows });
}, 'list super users');

/**
 * Get platform-level SMTP settings from environment variables
 * (read-only display for super admin)
 *
 * GET /api/super/email/smtp-settings
 */
const getSmtpSettings = asyncHandler(async (req, res) => {
  // Return SMTP settings from .env (without password)
  const settings = {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    username: process.env.SMTP_USER || '',
    from_email: process.env.SMTP_FROM_EMAIL || process.env.EMAIL_FROM || '',
    from_name: process.env.SMTP_FROM_NAME || 'Letably Platform',
    configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  };

  res.json({ settings });
}, 'get SMTP settings');

/**
 * Test platform SMTP connection
 *
 * POST /api/super/email/test-connection
 */
const testSmtpConnection = async (req, res) => {
  const nodemailer = require('nodemailer');

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.verify();

    await logAuditAction(
      req.superUser.id,
      'smtp_test_connection',
      null,
      null,
      { result: 'success' },
      getClientIp(req)
    );

    res.json({ success: true, message: 'SMTP connection successful' });
  } catch (err) {
    await logAuditAction(
      req.superUser.id,
      'smtp_test_connection',
      null,
      null,
      { result: 'failed', error: err.message },
      getClientIp(req)
    );

    res.json({ success: false, message: err.message });
  }
};

/**
 * Send test email using platform SMTP
 *
 * POST /api/super/email/test-send
 */
const sendTestEmail = asyncHandler(async (req, res) => {
  const nodemailer = require('nodemailer');

  const { to_email } = req.body;

  if (!to_email) {
    return res.status(400).json({ error: 'to_email is required' });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const fromName = process.env.SMTP_FROM_NAME || 'Letably Platform';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@letably.com';

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: to_email,
    subject: 'Letably Platform - Test Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Test Email</h1>
        <p>This is a test email from the Letably platform SMTP configuration.</p>
        <p>If you received this email, your SMTP settings are working correctly.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
      </div>
    `,
    text: `Test Email\n\nThis is a test email from the Letably platform SMTP configuration.\n\nIf you received this email, your SMTP settings are working correctly.\n\nSent at: ${new Date().toISOString()}`,
  });

  await logAuditAction(
    req.superUser.id,
    'smtp_test_send',
    null,
    null,
    { to_email, messageId: info.messageId },
    getClientIp(req)
  );

  res.json({ success: true, message: 'Test email sent', messageId: info.messageId });
}, 'send test email');

/**
 * Get platform-wide email queue (all agencies)
 *
 * GET /api/super/email/queue
 */
const getEmailQueue = asyncHandler(async (req, res) => {
  const { status, agency_id, limit = 100, offset = 0 } = req.query;

  let query = `
    SELECT
      eq.*,
      a.name as agency_name,
      a.slug as agency_slug
    FROM email_queue eq
    LEFT JOIN agencies a ON eq.agency_id = a.id
    WHERE 1=1
  `;

  const params = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND eq.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (agency_id) {
    query += ` AND eq.agency_id = $${paramIndex}`;
    params.push(agency_id);
    paramIndex++;
  }

  query += ` ORDER BY eq.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(parseInt(limit), parseInt(offset));

  const result = await db.systemQuery(query, params);

  // Get counts by status
  const statsResult = await db.systemQuery(`
    SELECT
      status,
      COUNT(*) as count
    FROM email_queue
    GROUP BY status
  `);

  const stats = {
    pending: 0,
    sent: 0,
    failed: 0,
    total: 0
  };

  statsResult.rows.forEach(row => {
    stats[row.status] = parseInt(row.count);
    stats.total += parseInt(row.count);
  });

  res.json({
    emails: result.rows,
    stats,
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset)
    }
  });
}, 'get email queue');

/**
 * Get email queue statistics by agency
 *
 * GET /api/super/email/queue/stats
 */
const getEmailQueueStats = asyncHandler(async (req, res) => {
  // Overall stats
  const overallResult = await db.systemQuery(`
    SELECT
      status,
      COUNT(*) as count
    FROM email_queue
    GROUP BY status
  `);

  const overall = {
    pending: 0,
    sent: 0,
    failed: 0,
    total: 0
  };

  overallResult.rows.forEach(row => {
    overall[row.status] = parseInt(row.count);
    overall.total += parseInt(row.count);
  });

  // Stats by agency
  const byAgencyResult = await db.systemQuery(`
    SELECT
      a.id as agency_id,
      a.name as agency_name,
      a.slug as agency_slug,
      COUNT(*) FILTER (WHERE eq.status = 'pending') as pending,
      COUNT(*) FILTER (WHERE eq.status = 'sent') as sent,
      COUNT(*) FILTER (WHERE eq.status = 'failed') as failed,
      COUNT(*) as total
    FROM email_queue eq
    LEFT JOIN agencies a ON eq.agency_id = a.id
    GROUP BY a.id, a.name, a.slug
    ORDER BY total DESC
  `);

  // Recent activity (last 24 hours)
  const recentResult = await db.systemQuery(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'sent' AND sent_at > NOW() - INTERVAL '24 hours') as sent_24h,
      COUNT(*) FILTER (WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours') as failed_24h,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as queued_24h
    FROM email_queue
  `);

  res.json({
    overall,
    by_agency: byAgencyResult.rows,
    recent: recentResult.rows[0]
  });
}, 'get email queue stats');

/**
 * Retry a failed email
 *
 * POST /api/super/email/queue/:id/retry
 */
const retryEmail = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Reset the email to pending
  const result = await db.systemQuery(
    `UPDATE email_queue
     SET status = 'pending',
         retry_count = 0,
         error_message = NULL
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Email not found' });
  }

  await logAuditAction(
    req.superUser.id,
    'email_retry',
    'email_queue',
    parseInt(id),
    { to_email: result.rows[0].to_email },
    getClientIp(req)
  );

  res.json({ email: result.rows[0] });
}, 'retry email');

/**
 * Delete an email from queue
 *
 * DELETE /api/super/email/queue/:id
 */
const deleteEmail = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get email first for audit log
  const getResult = await db.systemQuery(
    `SELECT to_email, subject, agency_id FROM email_queue WHERE id = $1`,
    [id]
  );

  if (getResult.rows.length === 0) {
    return res.status(404).json({ error: 'Email not found' });
  }

  const emailRecord = getResult.rows[0];

  // Delete the email
  await db.systemQuery('DELETE FROM email_queue WHERE id = $1', [id]);

  await logAuditAction(
    req.superUser.id,
    'email_delete',
    'email_queue',
    parseInt(id),
    { to_email: emailRecord.to_email, subject: emailRecord.subject, agency_id: emailRecord.agency_id },
    getClientIp(req)
  );

  res.json({ deleted: true });
}, 'delete email');

/**
 * Bulk delete emails (e.g., all sent emails older than X days)
 *
 * DELETE /api/super/email/queue/bulk
 */
const bulkDeleteEmails = asyncHandler(async (req, res) => {
  const { status, older_than_days } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'status is required' });
  }

  let query = 'DELETE FROM email_queue WHERE status = $1';
  const params = [status];

  if (older_than_days) {
    query += ` AND created_at < NOW() - INTERVAL '${parseInt(older_than_days)} days'`;
  }

  query += ' RETURNING id';

  const result = await db.systemQuery(query, params);
  const deletedCount = result.rows.length;

  await logAuditAction(
    req.superUser.id,
    'email_bulk_delete',
    'email_queue',
    null,
    { status, older_than_days, deleted_count: deletedCount },
    getClientIp(req)
  );

  res.json({ deleted_count: deletedCount });
}, 'bulk delete emails');

/**
 * Get storage usage for an agency
 *
 * GET /api/super/agencies/:id/storage
 */
const getAgencyStorageUsage = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Verify agency exists
  const agencyResult = await db.systemQuery(
    'SELECT id, name FROM agencies WHERE id = $1',
    [id]
  );
  if (agencyResult.rows.length === 0) {
    return res.status(404).json({ error: 'Agency not found' });
  }

  // Sum file_size across all file-storing tables for this agency
  const result = await db.systemQuery(`
    SELECT
      COALESCE(SUM(images_size), 0) as images_bytes,
      COALESCE(SUM(certs_size), 0) as certificates_bytes,
      COALESCE(SUM(maintenance_size), 0) as maintenance_attachments_bytes,
      COALESCE(SUM(id_docs_size), 0) as id_documents_bytes,
      COALESCE(SUM(exports_size), 0) as export_jobs_bytes
    FROM (
      SELECT
        (SELECT COALESCE(SUM(file_size), 0) FROM images WHERE agency_id = $1) as images_size,
        (SELECT COALESCE(SUM(file_size), 0) FROM certificates WHERE agency_id = $1) as certs_size,
        (SELECT COALESCE(SUM(file_size), 0) FROM maintenance_attachments WHERE agency_id = $1) as maintenance_size,
        (SELECT COALESCE(SUM(file_size), 0) FROM id_documents WHERE agency_id = $1) as id_docs_size,
        (SELECT COALESCE(SUM(file_size), 0) FROM export_jobs WHERE agency_id = $1) as exports_size
    ) t
  `, [id]);

  const row = result.rows[0];
  const total_bytes =
    parseInt(row.images_bytes) +
    parseInt(row.certificates_bytes) +
    parseInt(row.maintenance_attachments_bytes) +
    parseInt(row.id_documents_bytes) +
    parseInt(row.export_jobs_bytes);

  res.json({
    agency_id: parseInt(id),
    storage: {
      images_bytes: parseInt(row.images_bytes),
      certificates_bytes: parseInt(row.certificates_bytes),
      maintenance_attachments_bytes: parseInt(row.maintenance_attachments_bytes),
      id_documents_bytes: parseInt(row.id_documents_bytes),
      export_jobs_bytes: parseInt(row.export_jobs_bytes),
      total_bytes,
      total_kb: Math.round(total_bytes / 1024),
      total_mb: Math.round(total_bytes / (1024 * 1024) * 100) / 100
    }
  });
}, 'get agency storage usage');

/**
 * Toggle property images feature for an agency
 *
 * PATCH /api/super/agencies/:id/property-images
 */
const togglePropertyImages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { property_images_enabled } = req.body;

  if (typeof property_images_enabled !== 'boolean') {
    return res.status(400).json({ error: 'property_images_enabled must be a boolean' });
  }

  const result = await db.systemQuery(
    `UPDATE agencies
     SET property_images_enabled = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, name, slug, property_images_enabled`,
    [property_images_enabled, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Agency not found' });
  }

  // Log the action
  await logAuditAction(
    req.superUser.id,
    property_images_enabled ? 'property_images_enabled' : 'property_images_disabled',
    'agency',
    parseInt(id),
    { agency_name: result.rows[0].name },
    getClientIp(req)
  );

  res.json({ agency: result.rows[0] });
}, 'toggle property images');

module.exports = {
  login,
  getCurrentUser,
  listAgencies,
  getAgency,
  toggleAgencyStatus,
  updateAgencySubscription,
  getPlatformStats,
  getAgencyUsers,
  impersonateUser,
  getAuditLog,
  createSuperUser,
  listSuperUsers,
  getAgencyStorageUsage,
  togglePropertyImages,
  // Email queue
  getSmtpSettings,
  testSmtpConnection,
  sendTestEmail,
  getEmailQueue,
  getEmailQueueStats,
  retryEmail,
  deleteEmail,
  bulkDeleteEmails
};
