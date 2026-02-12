-- Migration: Remove Tenancy Takeovers
-- Takeovers are no longer a legal mechanism. This migration removes all
-- takeover-related tables, columns, agreement sections, and normalizes
-- any tenancy statuses that were in transitional takeover states.
--
-- Run with: psql -f remove_takeovers.sql

BEGIN;

-- ============================================================
-- 1. Drop takeover tables
-- ============================================================

-- Drop takeover_participants first (has FK to takeover_requests)
DROP TABLE IF EXISTS takeover_participants CASCADE;

-- Drop takeover_requests
DROP TABLE IF EXISTS takeover_requests CASCADE;

-- ============================================================
-- 2. Remove takeover-related columns from tenancies
-- ============================================================

ALTER TABLE tenancies DROP COLUMN IF EXISTS replaced_tenancy_id;

-- ============================================================
-- 3. Remove takeover addendum agreement sections
-- ============================================================

DELETE FROM agreement_sections WHERE agreement_type = 'takeover_addendum';

-- ============================================================
-- 4. Normalize any tenancies stuck in takeover statuses
-- ============================================================

UPDATE tenancies SET status = 'expired', updated_at = CURRENT_TIMESTAMP
WHERE status IN ('taken_over', 'awaiting_new_tenancy');

-- ============================================================
-- 5. Remove any signed documents for takeover addendums
-- ============================================================

-- signed_documents may not exist yet; handle gracefully
DO $$
BEGIN
  DELETE FROM signed_documents WHERE document_type = 'takeover_addendum';
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

COMMIT;
