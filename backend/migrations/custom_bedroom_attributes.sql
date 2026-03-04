-- Custom Bedroom Attributes Migration
-- Drops hardcoded youtube_url column from bedrooms table
-- Creates EAV tables for per-agency custom bedroom attributes

BEGIN;

-- ══════════════════════════════════════════════════════════
-- 1. Drop non-core columns from bedrooms
-- ══════════════════════════════════════════════════════════

ALTER TABLE bedrooms DROP COLUMN IF EXISTS youtube_url;

-- ══════════════════════════════════════════════════════════
-- 2. Create attribute definitions table (per agency)
-- ══════════════════════════════════════════════════════════

CREATE TABLE bedroom_attribute_definitions (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  attribute_type VARCHAR(20) NOT NULL CHECK (attribute_type IN ('text', 'number', 'boolean', 'dropdown')),
  options JSONB DEFAULT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agency_id, name)
);

-- ══════════════════════════════════════════════════════════
-- 3. Create attribute values table (per bedroom)
-- ══════════════════════════════════════════════════════════

CREATE TABLE bedroom_attribute_values (
  id SERIAL PRIMARY KEY,
  bedroom_id INTEGER NOT NULL REFERENCES bedrooms(id) ON DELETE CASCADE,
  attribute_definition_id INTEGER NOT NULL REFERENCES bedroom_attribute_definitions(id) ON DELETE CASCADE,
  agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  value_text TEXT,
  value_number DECIMAL,
  value_boolean BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bedroom_id, attribute_definition_id)
);

-- ══════════════════════════════════════════════════════════
-- 4. Indexes
-- ══════════════════════════════════════════════════════════

CREATE INDEX idx_bad_agency_id ON bedroom_attribute_definitions(agency_id);
CREATE INDEX idx_bav_agency_id ON bedroom_attribute_values(agency_id);
CREATE INDEX idx_bav_bedroom_id ON bedroom_attribute_values(bedroom_id);
CREATE INDEX idx_bav_definition_id ON bedroom_attribute_values(attribute_definition_id);

-- ══════════════════════════════════════════════════════════
-- 5. RLS policies
-- ══════════════════════════════════════════════════════════

ALTER TABLE bedroom_attribute_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bedroom_attribute_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY bad_agency_isolation ON bedroom_attribute_definitions
  USING (agency_id = current_setting('app.current_agency_id', true)::integer);

CREATE POLICY bav_agency_isolation ON bedroom_attribute_values
  USING (agency_id = current_setting('app.current_agency_id', true)::integer);

COMMIT;
