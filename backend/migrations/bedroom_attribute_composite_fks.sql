-- Add composite foreign keys to bedroom_attribute_values
-- Ensures bedroom_id and attribute_definition_id belong to the same agency

BEGIN;

-- Add unique constraints needed for composite FK references
ALTER TABLE bedrooms ADD CONSTRAINT bedrooms_id_agency_unique UNIQUE (id, agency_id);
ALTER TABLE bedroom_attribute_definitions ADD CONSTRAINT bad_id_agency_unique UNIQUE (id, agency_id);

-- Drop existing simple FKs
ALTER TABLE bedroom_attribute_values DROP CONSTRAINT IF EXISTS bedroom_attribute_values_bedroom_id_fkey;
ALTER TABLE bedroom_attribute_values DROP CONSTRAINT IF EXISTS bedroom_attribute_values_attribute_definition_id_fkey;

-- Add composite FKs that enforce agency_id match
ALTER TABLE bedroom_attribute_values
  ADD CONSTRAINT bav_bedroom_agency_fk
  FOREIGN KEY (bedroom_id, agency_id) REFERENCES bedrooms(id, agency_id) ON DELETE CASCADE;

ALTER TABLE bedroom_attribute_values
  ADD CONSTRAINT bav_definition_agency_fk
  FOREIGN KEY (attribute_definition_id, agency_id) REFERENCES bedroom_attribute_definitions(id, agency_id) ON DELETE CASCADE;

-- Apply same fix to property_attribute_values
ALTER TABLE properties ADD CONSTRAINT properties_id_agency_unique UNIQUE (id, agency_id);
ALTER TABLE property_attribute_definitions ADD CONSTRAINT pad_id_agency_unique UNIQUE (id, agency_id);

ALTER TABLE property_attribute_values DROP CONSTRAINT IF EXISTS property_attribute_values_property_id_fkey;
ALTER TABLE property_attribute_values DROP CONSTRAINT IF EXISTS property_attribute_values_attribute_definition_id_fkey;

ALTER TABLE property_attribute_values
  ADD CONSTRAINT pav_property_agency_fk
  FOREIGN KEY (property_id, agency_id) REFERENCES properties(id, agency_id) ON DELETE CASCADE;

ALTER TABLE property_attribute_values
  ADD CONSTRAINT pav_definition_agency_fk
  FOREIGN KEY (attribute_definition_id, agency_id) REFERENCES property_attribute_definitions(id, agency_id) ON DELETE CASCADE;

COMMIT;
