/**
 * Agency Settings Model
 *
 * Database operations for agency-specific settings.
 * Uses site_settings table (key-value store) with RLS via agency_id context.
 */

const db = require('../db');

// Default values for settings
const DEFAULTS = {
  email_from_name: null,
  email_reply_to: null,
  payment_reminder_days_before: '7',
  overdue_reminder_frequency: '3',
  certificate_reminder_days: '30',
  default_tenancy_agreement_id: null,
  public_site_enabled: 'true',
  holding_deposit_enabled: 'false',
  holding_deposit_type: '1_week_pppw',
  holding_deposit_amount: '100'
};

/**
 * Get all agency settings as an object
 */
async function get(agencyId) {
  const result = await db.query(
    `SELECT setting_key, setting_value FROM site_settings`,
    [],
    agencyId
  );

  // Build settings object with defaults
  const settings = { ...DEFAULTS };
  for (const row of result.rows) {
    settings[row.setting_key] = row.setting_value;
  }

  // Convert types for consistency
  return {
    email_from_name: settings.email_from_name,
    email_reply_to: settings.email_reply_to,
    payment_reminder_days_before: parseInt(settings.payment_reminder_days_before, 10) || 7,
    overdue_reminder_frequency: parseInt(settings.overdue_reminder_frequency, 10) || 3,
    certificate_reminder_days: parseInt(settings.certificate_reminder_days, 10) || 30,
    default_tenancy_agreement_id: settings.default_tenancy_agreement_id ? parseInt(settings.default_tenancy_agreement_id, 10) : null,
    public_site_enabled: settings.public_site_enabled === 'true',
    holding_deposit_enabled: settings.holding_deposit_enabled === 'true',
    holding_deposit_type: settings.holding_deposit_type || '1_week_pppw',
    holding_deposit_amount: parseFloat(settings.holding_deposit_amount) || 100
  };
}

/**
 * Get a single setting value
 */
async function getSetting(agencyId, key) {
  const result = await db.query(
    `SELECT setting_value FROM site_settings WHERE setting_key = $1`,
    [key],
    agencyId
  );
  return result.rows[0]?.setting_value ?? DEFAULTS[key] ?? null;
}

/**
 * Set a single setting value
 */
async function setSetting(agencyId, key, value) {
  await db.query(
    `INSERT INTO site_settings (agency_id, setting_key, setting_value, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (agency_id, setting_key) DO UPDATE SET
       setting_value = EXCLUDED.setting_value,
       updated_at = NOW()`,
    [agencyId, key, value?.toString() ?? null],
    agencyId
  );
}

/**
 * Create default agency settings (called when agency is created)
 */
async function create(agencyId, data = {}) {
  const settings = { ...DEFAULTS, ...data };

  for (const [key, value] of Object.entries(settings)) {
    if (value !== null && value !== undefined) {
      await setSetting(agencyId, key, value);
    }
  }

  return get(agencyId);
}

/**
 * Update agency settings
 */
async function update(agencyId, data) {
  const allowedFields = [
    'email_from_name',
    'email_reply_to',
    'payment_reminder_days_before',
    'overdue_reminder_frequency',
    'certificate_reminder_days',
    'default_tenancy_agreement_id',
    'public_site_enabled',
    'holding_deposit_enabled',
    'holding_deposit_type',
    'holding_deposit_amount'
  ];

  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key)) {
      await setSetting(agencyId, key, value);
    }
  }

  return get(agencyId);
}

module.exports = {
  get,
  getSetting,
  setSetting,
  create,
  update
};
