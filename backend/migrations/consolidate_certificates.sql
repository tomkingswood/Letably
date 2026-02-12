-- Migration: Consolidate certificate/document tables
-- Merges property_certificates + agency_documents → certificates
-- Merges certificate_types + agency_document_types → certificate_types
--
-- Prerequisites: property_certificates and agency_documents have 0 rows
-- Run with: psql -f consolidate_certificates.sql

BEGIN;

-- ============================================================
-- 1. ALTER certificate_types: add new columns
-- ============================================================
ALTER TABLE certificate_types ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'property';
ALTER TABLE certificate_types ADD COLUMN has_expiry BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE certificate_types ADD COLUMN created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE certificate_types ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- 2. Update existing rows to be explicit about their type
UPDATE certificate_types SET type = 'property', has_expiry = true;

-- ============================================================
-- 3. Migrate agency_document_types → certificate_types
-- ============================================================
INSERT INTO certificate_types (agency_id, name, display_name, description, has_expiry, display_order, is_active, type, created_at, updated_at)
SELECT agency_id, name, name, description, has_expiry, display_order, is_active, 'agency', created_at, updated_at
FROM agency_document_types;

-- ============================================================
-- 4. RENAME property_certificates → certificates + ALTER
-- ============================================================
ALTER TABLE property_certificates RENAME TO certificates;

-- Add generic entity columns
ALTER TABLE certificates ADD COLUMN entity_type VARCHAR(20) NOT NULL DEFAULT 'property';
ALTER TABLE certificates ADD COLUMN entity_id INTEGER NOT NULL DEFAULT 0;

-- Migrate existing data (0 rows, but for correctness)
UPDATE certificates SET entity_type = 'property', entity_id = property_id;

-- Add missing columns from agency_documents
ALTER TABLE certificates ADD COLUMN filename VARCHAR(255);
ALTER TABLE certificates ADD COLUMN mime_type VARCHAR(100);
ALTER TABLE certificates ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Drop old FK column
ALTER TABLE certificates DROP COLUMN property_id;

-- Add indexes for lookups
CREATE INDEX idx_certificates_entity ON certificates(entity_type, entity_id, agency_id);
CREATE INDEX idx_certificates_agency ON certificates(agency_id);

-- ============================================================
-- 5. Drop old tables
-- ============================================================
DROP TABLE agency_documents;
DROP TABLE agency_document_types;

COMMIT;
