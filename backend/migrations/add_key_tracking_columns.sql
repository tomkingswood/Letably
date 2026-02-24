-- Add key tracking columns to tenancy_members
-- These columns track key collection and return for each tenant

ALTER TABLE tenancy_members
  ADD COLUMN IF NOT EXISTS key_status VARCHAR(20) DEFAULT 'not_collected',
  ADD COLUMN IF NOT EXISTS key_collection_date DATE,
  ADD COLUMN IF NOT EXISTS key_return_date DATE;
