ALTER TABLE rooms RENAME TO bedrooms;
ALTER TABLE bedrooms RENAME COLUMN room_name TO bedroom_name;
ALTER TABLE bedrooms RENAME COLUMN room_description TO bedroom_description;
ALTER TABLE images RENAME COLUMN room_id TO bedroom_id;
ALTER TABLE tenancy_members RENAME COLUMN room_id TO bedroom_id;
ALTER TABLE tenancies RENAME COLUMN room_id TO bedroom_id;
ALTER TABLE properties DROP COLUMN bedrooms;
