/**
 * Database Migration Runner
 *
 * Runs all SQL migration files in order from the migrations directory.
 * Tracks which migrations have been run in a schema_migrations table.
 *
 * Usage: npm run migrate
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(client) {
  const result = await client.query('SELECT filename FROM schema_migrations ORDER BY filename');
  return new Set(result.rows.map(row => row.filename));
}

async function getMigrationFiles() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
  return files;
}

async function runMigration(client, filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, 'utf8');

  console.log(`  Running: ${filename}`);

  await client.query(sql);
  await client.query(
    'INSERT INTO schema_migrations (filename) VALUES ($1)',
    [filename]
  );

  console.log(`  Completed: ${filename}`);
}

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('\n=== Letably Database Migration ===\n');

    await ensureMigrationsTable(client);

    const executed = await getExecutedMigrations(client);
    const files = await getMigrationFiles();

    const pending = files.filter(f => !executed.has(f));

    if (pending.length === 0) {
      console.log('No pending migrations.\n');
      return;
    }

    console.log(`Found ${pending.length} pending migration(s):\n`);

    await client.query('BEGIN');

    try {
      for (const file of pending) {
        await runMigration(client, file);
      }

      await client.query('COMMIT');
      console.log('\n=== All migrations completed successfully ===\n');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('\n=== Migration failed, rolled back ===\n');
      throw error;
    }

  } finally {
    client.release();
    await pool.end();
  }
}

// Run migrations
migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
