-- Drop the bedroom status column
-- Occupancy is now derived from active tenancies, not a manual field
ALTER TABLE bedrooms DROP COLUMN IF EXISTS status;
