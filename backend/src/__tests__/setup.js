/**
 * Jest Test Setup
 *
 * Configures the test environment with:
 * - Test database connection
 * - Environment variables
 * - Global test utilities
 */

const path = require('path');

// Load test environment variables
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env.test')
});

// Set test-specific defaults
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing-only';

// Increase timeout for integration tests
jest.setTimeout(10000);

// Clean up database connections after all tests
afterAll(async () => {
  // Close the database pool if it exists
  const db = require('../db');
  if (db.pool) {
    await db.pool.end();
  }
});
