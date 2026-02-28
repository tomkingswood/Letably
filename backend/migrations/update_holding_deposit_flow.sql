-- Migration: Update holding deposit flow
-- Adds 'awaiting_payment' status for deposits created at application time
-- Makes date_received nullable (not known until payment)
-- Adds ON DELETE CASCADE to application_id FK

-- 1. Drop and recreate CHECK constraint to add 'awaiting_payment'
ALTER TABLE holding_deposits DROP CONSTRAINT IF EXISTS holding_deposits_status_check;
ALTER TABLE holding_deposits ADD CONSTRAINT holding_deposits_status_check
  CHECK (status IN ('awaiting_payment', 'held', 'applied_to_rent', 'applied_to_deposit', 'refunded', 'forfeited'));

-- 2. Change DEFAULT from 'held' to 'awaiting_payment'
ALTER TABLE holding_deposits ALTER COLUMN status SET DEFAULT 'awaiting_payment';

-- 3. Make date_received nullable
ALTER TABLE holding_deposits ALTER COLUMN date_received DROP NOT NULL;

-- 4. Drop and re-add application_id FK with ON DELETE CASCADE
ALTER TABLE holding_deposits DROP CONSTRAINT IF EXISTS holding_deposits_application_id_fkey;
ALTER TABLE holding_deposits ADD CONSTRAINT holding_deposits_application_id_fkey
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE;
