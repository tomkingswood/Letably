/**
 * PostgreSQL Database Connection
 *
 * Provides a connection pool for PostgreSQL with multi-tenancy support.
 * Uses Row-Level Security (RLS) for agency data isolation.
 */

const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Log pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

/**
 * Safely set agency context for RLS using parameterized query
 * @param {object} client - Database client
 * @param {number} agencyId - Agency ID
 */
async function setAgencyContext(client, agencyId) {
  // Validate agencyId is a positive integer
  const id = parseInt(agencyId, 10);
  if (isNaN(id) || id <= 0) {
    throw new Error('Invalid agency ID');
  }
  // Use set_config with parameterized values - safe from SQL injection
  await client.query('SELECT set_config($1, $2, false)', ['app.agency_id', String(id)]);
}

/**
 * Safely set agency context for RLS within a transaction (LOCAL scope)
 * @param {object} client - Database client
 * @param {number} agencyId - Agency ID
 */
async function setAgencyContextLocal(client, agencyId) {
  // Validate agencyId is a positive integer
  const id = parseInt(agencyId, 10);
  if (isNaN(id) || id <= 0) {
    throw new Error('Invalid agency ID');
  }
  // Use set_config with LOCAL = true for transaction scope
  await client.query('SELECT set_config($1, $2, true)', ['app.agency_id', String(id)]);
}

/**
 * Reset agency context
 * @param {object} client - Database client
 */
async function resetAgencyContext(client) {
  await client.query('RESET app.agency_id');
}

/**
 * Execute a query with the agency context set for RLS
 *
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @param {number|null} agencyId - Agency ID for RLS context
 * @returns {Promise<object>} Query result
 */
async function query(text, params = [], agencyId = null) {
  const client = await pool.connect();
  try {
    // Set agency context for RLS if provided
    if (agencyId) {
      await setAgencyContext(client, agencyId);
    } else {
      // Reset to prevent leaking previous agency context
      await resetAgencyContext(client);
    }
    const result = await client.query(text, params);
    return result;
  } finally {
    // Reset before releasing back to pool
    await resetAgencyContext(client).catch(() => {});
    client.release();
  }
}

/**
 * Get a client from the pool with agency context set
 *
 * @param {number} agencyId - Agency ID for RLS context
 * @returns {Promise<object>} Database client
 */
async function getClient(agencyId) {
  const client = await pool.connect();
  if (agencyId) {
    await setAgencyContext(client, agencyId);
  }
  return client;
}

/**
 * Execute a transaction with agency context
 *
 * @param {Function} callback - Async function receiving (client)
 * @param {number|null} agencyId - Agency ID for RLS context
 * @returns {Promise<any>} Result from callback
 */
async function transaction(callback, agencyId = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // SET LOCAL inside transaction - scoped to this transaction only
    if (agencyId) {
      await setAgencyContextLocal(client, agencyId);
    }

    try {
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    client.release();
  }
}

/**
 * Helper to run a query without RLS (for system operations)
 * Use with caution - bypasses agency isolation
 *
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<object>} Query result
 */
async function systemQuery(text, params = []) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
  getClient,
  transaction,
  systemQuery
};
