#!/usr/bin/env node
/**
 * Create Super User Script
 *
 * Creates the initial super admin user for Letably platform.
 * Run: node scripts/create-super-user.js
 *
 * You will be prompted for email and password.
 */

require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

async function createSuperUser() {
  console.log('\n=== Create Letably Super Admin ===\n');

  try {
    // Get user input
    const email = await question('Email: ');
    const firstName = await question('First Name: ');
    const lastName = await question('Last Name: ');
    const password = await question('Password: ');
    const confirmPassword = await question('Confirm Password: ');

    // Validate
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address');
    }

    if (!firstName || !lastName) {
      throw new Error('First and last name are required');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    // Check if user already exists
    const existing = await pool.query(
      'SELECT id FROM super_users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (existing.rows.length > 0) {
      throw new Error('A super user with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO super_users (email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, 'super_admin')
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email.toLowerCase().trim(), passwordHash, firstName, lastName]
    );

    const user = result.rows[0];

    console.log('\n=== Super Admin Created ===');
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Name: ${user.first_name} ${user.last_name}`);
    console.log(`Role: ${user.role}`);
    console.log(`Created: ${user.created_at}`);
    console.log('\nYou can now log in at /sup3rAdm1n\n');

  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await pool.end();
  }
}

createSuperUser();
