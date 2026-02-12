/**
 * Super Admin Authentication Middleware
 *
 * Handles JWT authentication for Letably platform staff (super users).
 * These tokens are separate from agency-scoped tokens.
 */

const jwt = require('jsonwebtoken');
const db = require('../db');

// SECURITY: Require explicit super admin JWT secret - no fallback
const getSuperSecret = () => {
  const secret = process.env.SUPER_JWT_SECRET;
  if (!secret) {
    throw new Error('SECURITY: SUPER_JWT_SECRET environment variable must be set');
  }
  if (secret.length < 32) {
    throw new Error('SECURITY: SUPER_JWT_SECRET must be at least 32 characters long');
  }
  return secret;
};

/**
 * Middleware to verify super admin JWT token
 *
 * Super admin tokens don't have agency_id - they operate at platform level.
 */
const authenticateSuperUser = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, getSuperSecret());

    // Verify this is a super user token (has is_super flag)
    if (!decoded.is_super) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    // Verify user still exists and is active
    const result = await db.systemQuery(
      `SELECT id, email, first_name, last_name, role, is_active
       FROM super_users WHERE id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Super user not found' });
    }

    const superUser = result.rows[0];

    if (!superUser.is_active) {
      return res.status(403).json({ error: 'Super user account is disabled' });
    }

    // Set super user on request
    req.superUser = {
      id: superUser.id,
      email: superUser.email,
      first_name: superUser.first_name,
      last_name: superUser.last_name,
      role: superUser.role,
      is_super: true
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Generate a super user JWT token
 *
 * @param {object} superUser - Super user object
 * @returns {string} JWT token
 */
const generateSuperToken = (superUser) => {
  return jwt.sign(
    {
      id: superUser.id,
      email: superUser.email,
      role: superUser.role,
      is_super: true
    },
    getSuperSecret(),
    { expiresIn: process.env.SUPER_JWT_EXPIRES_IN || '8h' } // Shorter expiry for security
  );
};

/**
 * Log an action to the super user audit log
 *
 * @param {number} superUserId - Super user ID
 * @param {string} action - Action performed
 * @param {string} targetType - Type of target (agency, user, etc.)
 * @param {number} targetId - ID of target
 * @param {object} details - Additional details
 * @param {string} ipAddress - IP address of request
 */
const logAuditAction = async (superUserId, action, targetType, targetId, details, ipAddress) => {
  try {
    await db.systemQuery(
      `INSERT INTO super_user_audit_log
       (super_user_id, action, target_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [superUserId, action, targetType, targetId, JSON.stringify(details), ipAddress]
    );
  } catch (error) {
    console.error('Failed to log audit action:', error);
    // Don't throw - audit logging should not break the main operation
  }
};

/**
 * Helper to get client IP from request
 */
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.connection?.remoteAddress ||
         req.ip ||
         'unknown';
};

module.exports = {
  authenticateSuperUser,
  generateSuperToken,
  logAuditAction,
  getClientIp,
  getSuperSecret
};
