-- Migration: Add missing columns + form_data JSONB for conditional fields
-- Date: 2026-02-19
--
-- Design: Hybrid approach for applications table
--   Core columns: always-present fields, workflow columns, guarantor fields
--   JSONB form_data: conditional fields that vary by application_type / residential_status
--   form_version: integer tracking which version of the form created the data
--
-- See CLAUDE.md "Application form_data Pattern" for details.

-- =============================================
-- 1. applications table - core columns (always present)
-- =============================================

-- Personal info (may already exist from initial schema)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS title_other VARCHAR(255);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS middle_name VARCHAR(255);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS current_address TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS id_type VARCHAR(100);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100);

-- Declaration
ALTER TABLE applications ADD COLUMN IF NOT EXISTS declaration_name VARCHAR(255);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS declaration_agreed BOOLEAN DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS declaration_date TIMESTAMPTZ;

-- Workflow
ALTER TABLE applications ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS guarantor_token VARCHAR(255);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS guarantor_token_expires_at TIMESTAMPTZ;

-- Guarantor personal info (written by separate guarantor form flow)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS guarantor_name VARCHAR(255);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS guarantor_dob DATE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS guarantor_email VARCHAR(255);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS guarantor_phone VARCHAR(50);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS guarantor_address TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS guarantor_relationship VARCHAR(100);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS guarantor_id_type VARCHAR(100);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS guarantor_signature_name VARCHAR(255);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS guarantor_signature_agreed BOOLEAN DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS guarantor_completed_at TIMESTAMPTZ;

-- =============================================
-- 1b. applications table - JSONB for conditional form fields
-- =============================================
-- Stores fields that vary by application_type (student/professional)
-- and residential_status (Private Tenant shows landlord fields, etc.)
--
-- Fields stored in form_data:
--   residential_status, residential_status_other, period_years, period_months,
--   landlord_name, landlord_address, landlord_email, landlord_phone,
--   address_history (array of objects),
--   university, year_of_study, course, student_number, payment_plan,
--   employment_type, company_name, employment_start_date,
--   contact_name, contact_job_title, contact_email, contact_phone,
--   company_address

ALTER TABLE applications ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT '{}';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS form_version INTEGER DEFAULT 1;

-- =============================================
-- 2. certificate_types table - add missing icon column
-- =============================================
ALTER TABLE certificate_types ADD COLUMN IF NOT EXISTS icon VARCHAR(100);

-- =============================================
-- 3. signed_documents table - create if not exists
-- =============================================
CREATE TABLE IF NOT EXISTS signed_documents (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL REFERENCES agencies(id),
  document_type VARCHAR(100) NOT NULL,
  reference_id INTEGER NOT NULL,
  user_id INTEGER REFERENCES users(id),
  member_id INTEGER,
  participant_id INTEGER,
  signature_data TEXT,
  signed_html TEXT,
  document_hash VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  signed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add RLS policy for signed_documents
ALTER TABLE signed_documents ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'signed_documents_agency_isolation') THEN
    CREATE POLICY signed_documents_agency_isolation ON signed_documents
      USING (agency_id = current_setting('app.agency_id', true)::integer);
  END IF;
END $$;

-- =============================================
-- 4. tenant_documents table - create if not exists
-- =============================================
CREATE TABLE IF NOT EXISTS tenant_documents (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL REFERENCES agencies(id),
  tenancy_member_id INTEGER NOT NULL,
  document_type VARCHAR(100) NOT NULL,
  original_filename VARCHAR(500) NOT NULL,
  file_path VARCHAR(1000) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add RLS policy for tenant_documents
ALTER TABLE tenant_documents ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_documents_agency_isolation') THEN
    CREATE POLICY tenant_documents_agency_isolation ON tenant_documents
      USING (agency_id = current_setting('app.agency_id', true)::integer);
  END IF;
END $$;
