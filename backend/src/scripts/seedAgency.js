/**
 * Seed Agency Script
 *
 * Creates a test agency with an admin user for development.
 *
 * Usage: npm run seed:agency
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function seedAgency() {
  const client = await pool.connect();

  try {
    console.log('\n=== Seeding Agency Data ===\n');

    await client.query('BEGIN');

    // Create test agency for development
    const agencyResult = await client.query(`
      INSERT INTO agencies (name, slug, email, phone, primary_color, secondary_color, subscription_tier, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        updated_at = NOW()
      RETURNING id
    `, [
      'Test Agency',
      'test',
      'admin@test.com',
      '+44 114 123 4567',
      '#1E3A5F',
      '#CF722F',
      'premium',
      true
    ]);

    const agencyId = agencyResult.rows[0].id;
    console.log(`Created/updated agency: Test Agency (ID: ${agencyId})`);

    // Create default site settings for the agency
    const defaultSettings = [
      ['email_address', 'hello@test.com'],
      ['company_name', 'Test Agency'],
      ['contact_email', 'hello@test.com'],
      ['payment_reminder_days_before', '7'],
      ['overdue_reminder_frequency', '3'],
      ['certificate_reminder_days', '30'],
      ['public_site_enabled', 'true']
    ];

    for (const [key, value] of defaultSettings) {
      await client.query(`
        INSERT INTO site_settings (agency_id, setting_key, setting_value)
        VALUES ($1, $2, $3)
        ON CONFLICT (agency_id, setting_key) DO NOTHING
      `, [agencyId, key, value]);
    }

    // Create admin user
    const passwordHash = await bcrypt.hash('password123', 10);

    const userResult = await client.query(`
      INSERT INTO users (agency_id, email, password_hash, first_name, last_name, role, is_active, email_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (agency_id, email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        updated_at = NOW()
      RETURNING id
    `, [
      agencyId,
      'admin@test.com',
      passwordHash,
      'Admin',
      'User',
      'admin',
      true,
      true
    ]);

    console.log(`Created/updated admin user: admin@test.com (ID: ${userResult.rows[0].id})`);

    // Create a test tenant user
    const tenantResult = await client.query(`
      INSERT INTO users (agency_id, email, password_hash, first_name, last_name, role, is_active, email_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (agency_id, email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        updated_at = NOW()
      RETURNING id
    `, [
      agencyId,
      'tenant@test.com',
      passwordHash,
      'Test',
      'Tenant',
      'tenant',
      true,
      true
    ]);

    console.log(`Created/updated tenant user: tenant@test.com (ID: ${tenantResult.rows[0].id})`);

    await client.query('COMMIT');

    console.log('\n=== Seed Complete ===');
    console.log('\nTest Credentials:');
    console.log('  Agency: test');
    console.log('  Admin:  admin@test.com / password123');
    console.log('  Tenant: tenant@test.com / password123');
    console.log('\nLogin URL: http://localhost:3000/test/login\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedAgency().catch(err => {
  console.error('Failed to seed:', err);
  process.exit(1);
});
