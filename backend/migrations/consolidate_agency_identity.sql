-- Migration: Consolidate agency identity fields from site_settings to agencies table
-- Date: 2026-02-24
--
-- This migration makes the agencies table the single source of truth for
-- company_name, email_address, and phone_number. These were previously duplicated
-- in both the agencies table and the site_settings key-value table.

-- Step 1: Sync the latest user-edited values from site_settings into agencies
UPDATE agencies a SET
  name = COALESCE(ss_name.setting_value, a.name),
  email = COALESCE(ss_email.setting_value, a.email),
  phone = COALESCE(ss_phone.setting_value, a.phone)
FROM (SELECT agency_id, setting_value FROM site_settings WHERE setting_key = 'company_name') ss_name
LEFT JOIN (SELECT agency_id, setting_value FROM site_settings WHERE setting_key = 'email_address') ss_email ON ss_name.agency_id = ss_email.agency_id
LEFT JOIN (SELECT agency_id, setting_value FROM site_settings WHERE setting_key = 'phone_number') ss_phone ON ss_name.agency_id = ss_phone.agency_id
WHERE a.id = ss_name.agency_id;

-- Step 2: Delete obsolete keys from site_settings (including legacy contact_email/contact_phone)
DELETE FROM site_settings
WHERE setting_key IN ('company_name', 'email_address', 'phone_number', 'contact_email', 'contact_phone');
