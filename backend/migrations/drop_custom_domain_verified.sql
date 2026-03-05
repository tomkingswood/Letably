-- Drop custom_domain_verified column from agencies
-- Custom domains are now managed directly by super admins - if the domain is set, it's active.
-- No verification flow needed.

ALTER TABLE agencies DROP COLUMN IF EXISTS custom_domain_verified;
