/**
 * User and Auth Mocking Utilities
 *
 * Provides helpers for creating mock users and authentication tokens
 * for testing authenticated endpoints.
 */

const jwt = require('jsonwebtoken');
const { TEST_AGENCY_ID } = require('./testDb');

/**
 * User roles enum
 */
const ROLES = {
  ADMIN: 'admin',
  LANDLORD: 'landlord',
  TENANT: 'tenant'
};

/**
 * Create a mock user object
 * @param {object} overrides - Properties to override
 * @returns {object} Mock user
 */
function createMockUser(overrides = {}) {
  return {
    id: 1,
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    role: ROLES.ADMIN,
    agency_id: TEST_AGENCY_ID,
    is_active: true,
    ...overrides
  };
}

/**
 * Create a mock admin user
 * @param {object} overrides - Properties to override
 * @returns {object} Mock admin user
 */
function createMockAdmin(overrides = {}) {
  return createMockUser({
    role: ROLES.ADMIN,
    email: 'admin@example.com',
    ...overrides
  });
}

/**
 * Create a mock landlord user
 * @param {object} overrides - Properties to override
 * @returns {object} Mock landlord user
 */
function createMockLandlord(overrides = {}) {
  return createMockUser({
    id: 2,
    role: ROLES.LANDLORD,
    email: 'landlord@example.com',
    ...overrides
  });
}

/**
 * Create a mock tenant user
 * @param {object} overrides - Properties to override
 * @returns {object} Mock tenant user
 */
function createMockTenant(overrides = {}) {
  return createMockUser({
    id: 3,
    role: ROLES.TENANT,
    email: 'tenant@example.com',
    ...overrides
  });
}

/**
 * Generate a JWT token for a mock user
 * @param {object} user - User object
 * @param {object} options - JWT options
 * @returns {string} JWT token
 */
function generateToken(user, options = {}) {
  const secret = process.env.JWT_SECRET || 'test-secret-key-for-testing-only';
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    agency_id: user.agency_id || TEST_AGENCY_ID,
    first_name: user.first_name,
    last_name: user.last_name
  };

  return jwt.sign(payload, secret, {
    expiresIn: '1h',
    ...options
  });
}

/**
 * Generate an expired token for testing token expiry
 * @param {object} user - User object
 * @returns {string} Expired JWT token
 */
function generateExpiredToken(user) {
  return generateToken(user, { expiresIn: '-1h' });
}

/**
 * Create Authorization header value
 * @param {object} user - User object
 * @returns {string} Bearer token header value
 */
function authHeader(user) {
  return `Bearer ${generateToken(user)}`;
}

/**
 * Create a mock Express request object with authenticated user
 * @param {object} options - Request options
 * @returns {object} Mock request object
 */
function createMockReq(options = {}) {
  const user = options.user || createMockAdmin();
  return {
    user,
    agencyId: user.agency_id || TEST_AGENCY_ID,
    agency: options.agency || { id: TEST_AGENCY_ID, name: 'Test Agency' },
    headers: {
      authorization: authHeader(user),
      ...options.headers
    },
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    ...options
  };
}

/**
 * Create a mock Express response object
 * @returns {object} Mock response with status and json spies
 */
function createMockRes() {
  const res = {
    statusCode: null,
    jsonData: null,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.jsonData = data;
      return this;
    },
    send: function(data) {
      this.sendData = data;
      return this;
    },
    setHeader: jest.fn(),
    getHeader: jest.fn()
  };
  return res;
}

/**
 * Create a mock next function
 * @returns {Function} Mock next function
 */
function createMockNext() {
  return jest.fn();
}

module.exports = {
  ROLES,
  createMockUser,
  createMockAdmin,
  createMockLandlord,
  createMockTenant,
  generateToken,
  generateExpiredToken,
  authHeader,
  createMockReq,
  createMockRes,
  createMockNext
};
