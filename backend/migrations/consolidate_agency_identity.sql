-- Migration: Consolidate agency identity fields from site_settings to agencies table
-- Date: 2026-02-24
--
-- This migration makes the agencies table the single source of truth for
-- company_name, email_address, and phone_number. These were previously duplicated
-- in both the agencies table and the site_settings key-value table.

BEGIN;

-- Step 1: Sync the latest user-edited values from site_settings into agencies.
-- Uses a derived table that collects all distinct agency_ids across all three keys
-- so agencies with any subset of the keys are updated (not just those with company_name).
UPDATE agencies a SET
  name = COALESCE(ss.company_name, a.name),
  email = COALESCE(ss.email_address, a.email),
  phone = COALESCE(ss.phone_number, a.phone)
FROM (
  SELECT
    agency_id,
    MAX(setting_value) FILTER (WHERE setting_key = 'company_name') AS company_name,
    MAX(setting_value) FILTER (WHERE setting_key = 'email_address') AS email_address,
    MAX(setting_value) FILTER (WHERE setting_key = 'phone_number') AS phone_number
  FROM site_settings
  WHERE setting_key IN ('company_name', 'email_address', 'phone_number')
  GROUP BY agency_id
) ss
WHERE a.id = ss.agency_id;

-- Step 2: Delete obsolete keys from site_settings (including legacy contact_email/contact_phone)
DELETE FROM site_settings
WHERE setting_key IN ('company_name', 'email_address', 'phone_number', 'contact_email', 'contact_phone');

COMMIT;
