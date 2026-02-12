/**
 * Authentication Middleware
 *
 * Handles JWT authentication with multi-tenancy support.
 * JWT tokens contain agency_id for RLS enforcement.
 */

const jwt = require('jsonwebtoken');
const db = require('../db');

/**
 * Middleware to verify JWT token and set agency context for RLS
 *
 * Validates the token and ensures the user belongs to the correct agency.
 * Sets up the database context for Row-Level Security.
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Validate agency context matches
    if (req.agencyId && decoded.agency_id !== req.agencyId) {
      return res.status(403).json({
        error: 'Agency Mismatch',
        message: 'Token does not match the requested agency'
      });
    }

    // Set user and agency context from token
    req.user = decoded;
    req.agencyId = decoded.agency_id;

    // If agency wasn't set by agencyContext middleware, look it up
    if (!req.agency && decoded.agency_id) {
      const result = await db.systemQuery(
        `SELECT id, name, slug, email, phone, logo_url, primary_color, secondary_color,
                show_powered_by, subscription_tier, subscription_expires_at, is_active
         FROM agencies WHERE id = $1`,
        [decoded.agency_id]
      );
      req.agency = result.rows[0] || null;
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Middleware to check if user is admin
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Middleware to check if user is landlord
 */
const requireLandlord = (req, res, next) => {
  if (!req.user || req.user.role !== 'landlord') {
    return res.status(403).json({ error: 'Landlord access required' });
  }
  next();
};

/**
 * Middleware to lookup landlord by user ID and attach to request
 * Use after authenticateToken - adds req.landlord with landlord data
 */
const attachLandlord = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const result = await db.query(
      `SELECT id, name, email, phone, user_id
       FROM landlords
       WHERE user_id = $1`,
      [req.user.id],
      req.agencyId
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No landlord account found for this user'
      });
    }

    req.landlord = result.rows[0];
    next();
  } catch (error) {
    console.error('Error attaching landlord:', error);
    return res.status(500).json({ error: 'Failed to load landlord data' });
  }
};

/**
 * Optional authentication - populates req.user if token is present, but doesn't fail if missing
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.agencyId = decoded.agency_id;
    next();
  } catch (err) {
    // Invalid token, continue without user
    req.user = null;
    next();
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireLandlord,
  attachLandlord,
  optionalAuth
};
