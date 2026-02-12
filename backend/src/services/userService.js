/**
 * User Service - Shared user management functionality
 * Handles user creation with consistent logic across the application
 */

const db = require('../db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Create a new user account
 * @param {Object} options
 * @param {string} options.email - User's email address
 * @param {string} options.firstName - User's first name
 * @param {string} options.lastName - User's last name
 * @param {string} [options.phone] - User's phone number (optional)
 * @param {string} [options.role='tenant'] - User role ('tenant', 'landlord', 'admin')
 * @param {number} agencyId - Agency ID for multi-tenancy
 * @returns {Object} Result containing user data and setup token
 */
const createUser = async (options, agencyId) => {
  try {
    const {
      email,
      firstName,
      lastName,
      phone = null,
      role = 'tenant',
    } = options;

    // Validation
    if (!email || !firstName || !lastName) {
      throw new Error('Email, first name, and last name are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Validate role
    const validRoles = ['tenant', 'landlord', 'admin'];
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role. Must be tenant, landlord, or admin');
    }

    // Check if user already exists
    const existingResult = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email],
      agencyId
    );
    if (existingResult.rows[0]) {
      throw new Error('A user with this email already exists');
    }

    // Create a placeholder password hash (user will set their own via setup link)
    const password_hash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

    // Generate setup token (valid for 7 days)
    const setup_token = crypto.randomBytes(32).toString('hex');
    const setup_token_expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Create the user
    const insertResult = await db.query(
      `INSERT INTO users (agency_id, email, password_hash, first_name, last_name, phone, role, setup_token, setup_token_expires)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        agencyId,
        email.toLowerCase(),
        password_hash,
        firstName,
        lastName,
        phone || null,
        role,
        setup_token,
        setup_token_expires
      ],
      agencyId
    );

    const insertedUser = insertResult.rows[0];

    const user = {
      id: insertedUser.id,
      email: email.toLowerCase(),
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
      role,
    };

    return {
      user,
      setupToken: setup_token,
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createUser,
};
