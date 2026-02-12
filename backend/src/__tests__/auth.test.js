/**
 * Authentication Integration Tests
 *
 * Tests for auth controller endpoints:
 * - POST /api/auth/register
 * - POST /api/auth/login
 * - GET /api/auth/me
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authController = require('../controllers/authController');
const { createMockRes, createMockReq, createMockAdmin, generateToken } = require('./helpers/mockUser');
const { TEST_AGENCY_ID } = require('./helpers/testDb');

// Mock the db module
jest.mock('../db', () => ({
  query: jest.fn(),
  systemQuery: jest.fn(),
  pool: { end: jest.fn() }
}));

// Mock the agencyContext middleware
jest.mock('../middleware/agencyContext', () => ({
  getAgencyBySlug: jest.fn()
}));

const db = require('../db');
const { getAgencyBySlug } = require('../middleware/agencyContext');

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const req = createMockReq({
        body: {
          email: 'newuser@test.com',
          password: 'Password123!',
          first_name: 'New',
          last_name: 'User'
        },
        agencyId: TEST_AGENCY_ID
      });
      const res = createMockRes();

      // Mock: no existing user
      db.query.mockResolvedValueOnce({ rows: [] });
      // Mock: insert user
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: 'newuser@test.com',
          first_name: 'New',
          last_name: 'User',
          role: 'tenant'
        }]
      });

      await authController.register(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.user.email).toBe('newuser@test.com');
    });

    it('should reject registration with missing required fields', async () => {
      const req = createMockReq({
        body: {
          email: 'newuser@test.com'
          // missing password, first_name, last_name
        },
        agencyId: TEST_AGENCY_ID
      });
      const res = createMockRes();

      await authController.register(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.success).toBe(false);
      expect(res.jsonData.error).toContain('required');
    });

    it('should reject registration with invalid email', async () => {
      const req = createMockReq({
        body: {
          email: 'not-an-email',
          password: 'Password123!',
          first_name: 'New',
          last_name: 'User'
        },
        agencyId: TEST_AGENCY_ID
      });
      const res = createMockRes();

      await authController.register(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.success).toBe(false);
      expect(res.jsonData.error).toContain('email');
    });

    it('should reject registration with short password', async () => {
      const req = createMockReq({
        body: {
          email: 'newuser@test.com',
          password: 'short',
          first_name: 'New',
          last_name: 'User'
        },
        agencyId: TEST_AGENCY_ID
      });
      const res = createMockRes();

      await authController.register(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.success).toBe(false);
      expect(res.jsonData.error).toContain('8 characters');
    });

    it('should reject registration if email already exists', async () => {
      const req = createMockReq({
        body: {
          email: 'existing@test.com',
          password: 'Password123!',
          first_name: 'New',
          last_name: 'User'
        },
        agencyId: TEST_AGENCY_ID
      });
      const res = createMockRes();

      // Mock: user already exists
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await authController.register(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error).toBe('Email already registered');
    });

    it('should reject registration without agency context', async () => {
      const req = createMockReq({
        body: {
          email: 'newuser@test.com',
          password: 'Password123!',
          first_name: 'New',
          last_name: 'User'
        },
        agencyId: null
      });
      const res = createMockRes();

      await authController.register(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.error).toContain('Agency context');
    });
  });

  describe('POST /api/auth/login', () => {
    const mockAgency = {
      id: TEST_AGENCY_ID,
      name: 'Test Agency',
      slug: 'test-agency',
      is_active: true,
      logo_url: null,
      primary_color: '#000000'
    };

    const mockUser = {
      id: 1,
      email: 'user@test.com',
      password_hash: bcrypt.hashSync('Password123!', 10),
      first_name: 'Test',
      last_name: 'User',
      role: 'admin',
      is_active: true
    };

    it('should login successfully with valid credentials', async () => {
      const req = {
        body: {
          email: 'user@test.com',
          password: 'Password123!',
          agency_slug: 'test-agency'
        },
        agencyId: null,
        agency: null,
        headers: {}
      };
      const res = createMockRes();

      getAgencyBySlug.mockResolvedValue(mockAgency);
      db.query.mockResolvedValueOnce({ rows: [mockUser] }); // Find user
      db.query.mockResolvedValueOnce({ rows: [] }); // Update last login

      await authController.login(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.token).toBeDefined();
      expect(res.jsonData.data.user.email).toBe('user@test.com');
      expect(res.jsonData.data.agency.name).toBe('Test Agency');
    });

    it('should reject login with missing email/password', async () => {
      const req = createMockReq({
        body: { agency_slug: 'test-agency' }
      });
      const res = createMockRes();

      await authController.login(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.jsonData.success).toBe(false);
    });

    it('should reject login with invalid credentials', async () => {
      const req = {
        body: {
          email: 'user@test.com',
          password: 'WrongPassword!',
          agency_slug: 'test-agency'
        },
        agencyId: null,
        agency: null,
        headers: {}
      };
      const res = createMockRes();

      getAgencyBySlug.mockResolvedValue(mockAgency);
      db.query.mockResolvedValueOnce({ rows: [mockUser] });

      await authController.login(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData.error).toBe('Invalid credentials');
    });

    it('should reject login when user not found', async () => {
      const req = {
        body: {
          email: 'nonexistent@test.com',
          password: 'Password123!',
          agency_slug: 'test-agency'
        },
        agencyId: null,
        agency: null,
        headers: {}
      };
      const res = createMockRes();

      getAgencyBySlug.mockResolvedValue(mockAgency);
      db.query.mockResolvedValueOnce({ rows: [] }); // No user found

      await authController.login(req, res);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData.error).toBe('Invalid credentials');
    });

    it('should reject login when agency not found', async () => {
      const req = createMockReq({
        body: {
          email: 'user@test.com',
          password: 'Password123!',
          agency_slug: 'nonexistent-agency'
        },
        agencyId: null,
        agency: null
      });
      const res = createMockRes();

      getAgencyBySlug.mockResolvedValue(null);

      await authController.login(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.jsonData.error).toBe('Agency not found');
    });

    it('should reject login when agency is inactive', async () => {
      const req = {
        body: {
          email: 'user@test.com',
          password: 'Password123!',
          agency_slug: 'test-agency'
        },
        agencyId: null,
        agency: null,
        headers: {}
      };
      const res = createMockRes();

      getAgencyBySlug.mockResolvedValue({ ...mockAgency, is_active: false });

      await authController.login(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.jsonData.error).toContain('inactive');
    });

  });

  describe('GET /api/auth/current-user', () => {
    it('should return current user profile', async () => {
      const user = createMockAdmin();
      const req = createMockReq({ user });
      const res = createMockRes();

      db.query.mockResolvedValueOnce({
        rows: [{
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          phone: '07123456789'
        }]
      });

      await authController.getCurrentUser(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.data.user.email).toBe(user.email);
    });

    it('should return 404 if user not found in database', async () => {
      const user = createMockAdmin();
      const req = createMockReq({ user });
      const res = createMockRes();

      db.query.mockResolvedValueOnce({ rows: [] });

      await authController.getCurrentUser(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('Token Generation', () => {
    it('should include agency_id in token payload', () => {
      const user = createMockAdmin();
      const token = generateToken(user);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      expect(decoded.agency_id).toBe(TEST_AGENCY_ID);
      expect(decoded.id).toBe(user.id);
      expect(decoded.role).toBe(user.role);
    });
  });
});
