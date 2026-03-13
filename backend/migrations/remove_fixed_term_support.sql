-- Remove fixed-term tenancy support (Renters' Rights Act 2025)
-- All tenancies are now rolling monthly by default

ALTER TABLE tenancies DROP COLUMN IF EXISTS is_rolling_monthly;
