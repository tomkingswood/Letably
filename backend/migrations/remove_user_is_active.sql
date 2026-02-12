-- Migration: Remove is_active column from users table
-- User deactivation has been replaced with direct deletion (with FK constraint checks).
--
-- Run with: psql -f remove_user_is_active.sql

BEGIN;

ALTER TABLE users DROP COLUMN IF EXISTS is_active;

COMMIT;
