-- Rename viewing_requests.message to internal_notes
-- This column stores admin-facing internal notes, not visitor-facing messages

ALTER TABLE viewing_requests RENAME COLUMN message TO internal_notes;
