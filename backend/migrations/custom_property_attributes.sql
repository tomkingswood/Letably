-- Custom Property Attributes Migration
-- Drops hardcoded optional columns from properties table
-- Creates EAV tables for per-agency custom attributes

BEGIN;

-- ══════════════════════════════════════════════════════════
-- 1. Drop non-core columns from properties
-- ══════════════════════════════════════════════════════════

ALTER TABLE properties
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS bathrooms,
  DROP COLUMN IF EXISTS communal_areas,
  DROP COLUMN IF EXISTS property_type,
  DROP COLUMN IF EXISTS has_parking,
  DROP COLUMN IF EXISTS has_garden,
  DROP COLUMN IF EXISTS bills_included,
  DROP COLUMN IF EXISTS broadband_speed,
  DROP COLUMN IF EXISTS map_embed,
  DROP COLUMN IF EXISTS street_view_embed,
  DROP COLUMN IF EXISTS youtube_url;

-- ══════════════════════════════════════════════════════════
-- 2. Create attribute definitions table (per agency)
-- ══════════════════════════════════════════════════════════

CREATE TABLE property_attribute_definitions (
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
-- 3. Create attribute values table (per property)
-- ══════════════════════════════════════════════════════════

CREATE TABLE property_attribute_values (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  attribute_definition_id INTEGER NOT NULL REFERENCES property_attribute_definitions(id) ON DELETE CASCADE,
  agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  value_text TEXT,
  value_number DECIMAL,
  value_boolean BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, attribute_definition_id)
);

-- ══════════════════════════════════════════════════════════
-- 4. Indexes
-- ══════════════════════════════════════════════════════════

CREATE INDEX idx_pad_agency_id ON property_attribute_definitions(agency_id);
CREATE INDEX idx_pav_agency_id ON property_attribute_values(agency_id);
CREATE INDEX idx_pav_property_id ON property_attribute_values(property_id);
CREATE INDEX idx_pav_definition_id ON property_attribute_values(attribute_definition_id);

-- ══════════════════════════════════════════════════════════
-- 5. RLS policies
-- ══════════════════════════════════════════════════════════

ALTER TABLE property_attribute_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_attribute_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY pad_agency_isolation ON property_attribute_definitions
  USING (agency_id = current_setting('app.agency_id', true)::integer)
  WITH CHECK (agency_id = current_setting('app.agency_id', true)::integer);

CREATE POLICY pav_agency_isolation ON property_attribute_values
  USING (agency_id = current_setting('app.agency_id', true)::integer)
  WITH CHECK (agency_id = current_setting('app.agency_id', true)::integer);

COMMIT;
