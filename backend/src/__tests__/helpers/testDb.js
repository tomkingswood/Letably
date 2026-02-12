/**
 * Test Database Utilities
 *
 * Provides helpers for setting up and tearing down test data.
 * Uses transactions for isolation when possible.
 */

const db = require('../../db');

/**
 * Test agency ID - use a dedicated test agency
 */
const TEST_AGENCY_ID = 999;

/**
 * Create a test agency for isolation
 * @returns {Promise<object>} Created agency
 */
async function createTestAgency() {
  const result = await db.systemQuery(
    `INSERT INTO agencies (id, name, slug, email, is_active, subscription_tier, subscription_expires_at)
     VALUES ($1, $2, $3, $4, true, 'premium', NOW() + INTERVAL '1 year')
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [TEST_AGENCY_ID, 'Test Agency', 'test-agency', 'test@test-agency.com']
  );
  return result.rows[0];
}

/**
 * Clean up all test data for the test agency
 * Run this after each test suite
 */
async function cleanupTestData() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Delete in order respecting foreign keys
    const tables = [
      'payment_schedules',
      'tenancy_members',
      'tenancies',
      'bedrooms',
      'properties',
      'landlords',
      'applications',
      'maintenance_requests',
      'users'
    ];

    for (const table of tables) {
      try {
        await client.query(`DELETE FROM ${table} WHERE agency_id = $1`, [TEST_AGENCY_ID]);
      } catch (err) {
        // Table might not exist or have different structure, continue
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete the test agency completely
 */
async function deleteTestAgency() {
  await cleanupTestData();
  await db.systemQuery('DELETE FROM agencies WHERE id = $1', [TEST_AGENCY_ID]);
}

/**
 * Run a callback within a transaction that gets rolled back
 * Useful for tests that shouldn't persist data
 * @param {Function} callback - Async function receiving (client, agencyId)
 * @returns {Promise<any>} Result from callback
 */
async function withRollback(callback) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.agency_id', String(TEST_AGENCY_ID)]);

    const result = await callback(client, TEST_AGENCY_ID);

    // Always rollback - test isolation
    await client.query('ROLLBACK');
    return result;
  } finally {
    client.release();
  }
}

/**
 * Execute a query with test agency context
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<object>} Query result
 */
async function testQuery(text, params = []) {
  return db.query(text, params, TEST_AGENCY_ID);
}

module.exports = {
  TEST_AGENCY_ID,
  createTestAgency,
  cleanupTestData,
  deleteTestAgency,
  withRollback,
  testQuery
};
