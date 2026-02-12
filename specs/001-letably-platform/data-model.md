# Data Model: Letably Platform

**Branch**: `001-letably-platform` | **Date**: 2026-01-31

## Overview

This data model transforms the existing Steel City Living (SCL) SQLite schema into a multi-tenant PostgreSQL schema with Row-Level Security (RLS). All tenant-scoped tables gain an `agency_id` foreign key.

---

## New Entity: Agency

The central multi-tenancy entity. All other tenant-scoped entities reference this.

```sql
CREATE TABLE agencies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,           -- URL-safe identifier
    email TEXT NOT NULL,
    phone TEXT,

    -- Branding
    logo_url TEXT,
    primary_color TEXT DEFAULT '#1E3A5F',
    secondary_color TEXT,
    show_powered_by BOOLEAN DEFAULT true,

    -- Custom Domain (Premium)
    custom_portal_domain TEXT UNIQUE,
    custom_domain_verified BOOLEAN DEFAULT false,

    -- Subscription
    subscription_tier TEXT DEFAULT 'standard',  -- 'standard', 'premium'
    subscription_expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,

    -- Public API
    public_api_key TEXT UNIQUE,
    api_rate_limit INTEGER DEFAULT 1000,  -- requests per hour

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agencies_slug ON agencies(slug);
CREATE INDEX idx_agencies_custom_domain ON agencies(custom_portal_domain);
```

---

## User Management

### users

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    email TEXT NOT NULL,
    password_hash TEXT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    role TEXT NOT NULL,                   -- 'admin', 'tenant', 'landlord'

    -- Account Status
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    password_reset_token TEXT,
    password_reset_expires TIMESTAMP,
    setup_token TEXT,                     -- For initial password setup
    setup_token_expires TIMESTAMP,

    -- Preferences
    notification_preferences JSONB DEFAULT '{}',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,

    UNIQUE(agency_id, email)
);

CREATE INDEX idx_users_agency ON users(agency_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(agency_id, role);

-- RLS Policy
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON users
    USING (agency_id = current_setting('app.agency_id')::int);
```

---

## Property Management

### properties

```sql
CREATE TABLE properties (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    landlord_id INTEGER REFERENCES landlords(id) ON DELETE SET NULL,

    title TEXT NOT NULL,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    postcode TEXT NOT NULL,

    description TEXT,
    property_type TEXT,                   -- 'house', 'flat', 'hmo', etc.
    status TEXT DEFAULT 'draft',          -- 'draft', 'live', 'archived'

    -- Pricing (whole property let)
    rent_pppw NUMERIC(10,2),              -- Per person per week
    deposit_amount NUMERIC(10,2),

    -- Features
    bedrooms INTEGER,
    bathrooms INTEGER,
    has_parking BOOLEAN DEFAULT false,
    has_garden BOOLEAN DEFAULT false,
    pets_allowed BOOLEAN DEFAULT false,
    bills_included BOOLEAN DEFAULT false,

    -- Location
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    location_id INTEGER REFERENCES locations(id),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_properties_agency ON properties(agency_id);
CREATE INDEX idx_properties_landlord ON properties(landlord_id);
CREATE INDEX idx_properties_status ON properties(agency_id, status);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON properties
    USING (agency_id = current_setting('app.agency_id')::int);
```

### rooms

```sql
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    name TEXT NOT NULL,                   -- 'Room 1', 'Master Bedroom', etc.
    description TEXT,

    rent_pppw NUMERIC(10,2) NOT NULL,
    deposit_amount NUMERIC(10,2),

    -- Availability
    is_available BOOLEAN DEFAULT true,
    available_from DATE,

    -- Features
    room_size_sqft INTEGER,
    has_ensuite BOOLEAN DEFAULT false,
    has_double_bed BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rooms_agency ON rooms(agency_id);
CREATE INDEX idx_rooms_property ON rooms(property_id);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON rooms
    USING (agency_id = current_setting('app.agency_id')::int);
```

### certificates

```sql
CREATE TABLE certificates (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    certificate_type TEXT NOT NULL,       -- 'gas_safety', 'epc', 'electrical', 'fire_safety'
    file_path TEXT NOT NULL,
    original_filename TEXT,

    issue_date DATE,
    expiry_date DATE NOT NULL,

    -- Status
    is_expired BOOLEAN DEFAULT false,
    reminder_sent_30_days BOOLEAN DEFAULT false,
    reminder_sent_14_days BOOLEAN DEFAULT false,
    reminder_sent_7_days BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_certificates_agency ON certificates(agency_id);
CREATE INDEX idx_certificates_property ON certificates(property_id);
CREATE INDEX idx_certificates_expiry ON certificates(expiry_date);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON certificates
    USING (agency_id = current_setting('app.agency_id')::int);
```

### images

```sql
CREATE TABLE images (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,

    file_path TEXT NOT NULL,
    original_filename TEXT,
    alt_text TEXT,
    sort_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_images_agency ON images(agency_id);
CREATE INDEX idx_images_property ON images(property_id);
CREATE INDEX idx_images_room ON images(room_id);

ALTER TABLE images ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON images
    USING (agency_id = current_setting('app.agency_id')::int);
```

---

## Landlord Management

### landlords

```sql
CREATE TABLE landlords (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    user_id INTEGER REFERENCES users(id),  -- Optional portal access

    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,

    -- Address
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    postcode TEXT,

    -- Settings
    receive_maintenance_notifications BOOLEAN DEFAULT true,
    receive_payment_notifications BOOLEAN DEFAULT true,
    manage_rent BOOLEAN DEFAULT true,     -- Agency manages rent collection

    notes TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_landlords_agency ON landlords(agency_id);
CREATE INDEX idx_landlords_user ON landlords(user_id);

ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON landlords
    USING (agency_id = current_setting('app.agency_id')::int);
```

---

## Tenant & Tenancy Management

### applications

```sql
CREATE TABLE applications (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    property_id INTEGER REFERENCES properties(id),
    room_id INTEGER REFERENCES rooms(id),

    status TEXT DEFAULT 'pending',        -- 'pending', 'awaiting_guarantor', 'submitted', 'approved', 'rejected', 'converted_to_tenancy'

    -- Application Form Data
    form_data JSONB DEFAULT '{}',

    -- Guarantor
    guarantor_required BOOLEAN DEFAULT false,
    guarantor_form_data JSONB DEFAULT '{}',

    -- Dates
    desired_move_in DATE,

    -- Admin
    admin_notes TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_applications_agency ON applications(agency_id);
CREATE INDEX idx_applications_user ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(agency_id, status);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON applications
    USING (agency_id = current_setting('app.agency_id')::int);
```

### tenancies

```sql
CREATE TABLE tenancies (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    property_id INTEGER NOT NULL REFERENCES properties(id),
    room_id INTEGER REFERENCES rooms(id),
    application_id INTEGER REFERENCES applications(id),

    -- Status workflow
    status TEXT DEFAULT 'pending',        -- 'pending', 'awaiting_signatures', 'signed', 'approval', 'active', 'expired'

    -- Dates
    start_date DATE NOT NULL,
    end_date DATE,

    -- Rent Terms
    rent_amount NUMERIC(10,2) NOT NULL,
    rent_frequency TEXT DEFAULT 'weekly', -- 'weekly', 'monthly'
    payment_option TEXT DEFAULT 'monthly', -- 'monthly', 'quarterly', 'monthly_to_quarterly', 'upfront'
    deposit_amount NUMERIC(10,2),

    -- Tenancy Type
    is_rolling_monthly BOOLEAN DEFAULT false,
    auto_generate_payments BOOLEAN DEFAULT true,

    -- Agreement
    agreement_template_id INTEGER,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tenancies_agency ON tenancies(agency_id);
CREATE INDEX idx_tenancies_property ON tenancies(property_id);
CREATE INDEX idx_tenancies_room ON tenancies(room_id);
CREATE INDEX idx_tenancies_status ON tenancies(agency_id, status);
CREATE INDEX idx_tenancies_dates ON tenancies(start_date, end_date);

ALTER TABLE tenancies ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON tenancies
    USING (agency_id = current_setting('app.agency_id')::int);
```

### tenancy_members

```sql
CREATE TABLE tenancy_members (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    tenancy_id INTEGER NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),

    -- Signature
    is_signed BOOLEAN DEFAULT false,
    signature_data TEXT,                  -- Typed name
    signed_agreement_html TEXT,           -- Snapshot of signed agreement
    signed_at TIMESTAMP,

    -- Payment Option (selected at signing)
    payment_option TEXT,

    -- Guarantor
    guarantor_required BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tenancy_members_agency ON tenancy_members(agency_id);
CREATE INDEX idx_tenancy_members_tenancy ON tenancy_members(tenancy_id);
CREATE INDEX idx_tenancy_members_user ON tenancy_members(user_id);

ALTER TABLE tenancy_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON tenancy_members
    USING (agency_id = current_setting('app.agency_id')::int);
```

### guarantor_agreements

```sql
CREATE TABLE guarantor_agreements (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    tenancy_member_id INTEGER NOT NULL REFERENCES tenancy_members(id) ON DELETE CASCADE,

    -- Guarantor Details
    guarantor_name TEXT NOT NULL,
    guarantor_email TEXT NOT NULL,
    guarantor_phone TEXT,
    guarantor_address TEXT,

    -- Access Token (for public signing URL)
    guarantor_token TEXT UNIQUE NOT NULL,
    token_expires_at TIMESTAMP,

    -- Signature
    is_signed BOOLEAN DEFAULT false,
    signature_data TEXT,
    signed_agreement_html TEXT,
    signed_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_guarantor_agreements_agency ON guarantor_agreements(agency_id);
CREATE INDEX idx_guarantor_agreements_member ON guarantor_agreements(tenancy_member_id);
CREATE INDEX idx_guarantor_agreements_token ON guarantor_agreements(guarantor_token);

ALTER TABLE guarantor_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON guarantor_agreements
    USING (agency_id = current_setting('app.agency_id')::int);
```

---

## Payment Management

### payment_schedules

```sql
CREATE TABLE payment_schedules (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    tenancy_id INTEGER NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
    tenancy_member_id INTEGER REFERENCES tenancy_members(id),

    -- Amount
    amount_due NUMERIC(10,2) NOT NULL,

    -- Dates
    due_date DATE NOT NULL,
    covers_from DATE,
    covers_to DATE,

    -- Type
    payment_type TEXT NOT NULL,           -- 'rent', 'deposit', 'utilities', 'fees', 'other'
    schedule_type TEXT DEFAULT 'automated', -- 'automated', 'manual'

    -- Status (calculated from payments)
    status TEXT DEFAULT 'pending',        -- 'pending', 'paid', 'partial', 'overdue'

    description TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payment_schedules_agency ON payment_schedules(agency_id);
CREATE INDEX idx_payment_schedules_tenancy ON payment_schedules(tenancy_id);
CREATE INDEX idx_payment_schedules_due_date ON payment_schedules(due_date);
CREATE INDEX idx_payment_schedules_status ON payment_schedules(agency_id, status);

ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON payment_schedules
    USING (agency_id = current_setting('app.agency_id')::int);
```

### payments

```sql
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    payment_schedule_id INTEGER NOT NULL REFERENCES payment_schedules(id) ON DELETE CASCADE,

    amount NUMERIC(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_reference TEXT,

    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_agency ON payments(agency_id);
CREATE INDEX idx_payments_schedule ON payments(payment_schedule_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON payments
    USING (agency_id = current_setting('app.agency_id')::int);
```

---

## Maintenance Management

### maintenance_requests

```sql
CREATE TABLE maintenance_requests (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    tenancy_id INTEGER NOT NULL REFERENCES tenancies(id),
    created_by_user_id INTEGER NOT NULL REFERENCES users(id),

    title TEXT NOT NULL,
    description TEXT NOT NULL,

    category TEXT NOT NULL,               -- 'plumbing', 'electrical', 'heating', 'appliances', 'structural', 'pest_control', 'general', 'other'
    priority TEXT DEFAULT 'medium',       -- 'low', 'medium', 'high'
    status TEXT DEFAULT 'submitted',      -- 'submitted', 'in_progress', 'completed'

    -- Resolution
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES users(id),
    resolution_notes TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_maintenance_requests_agency ON maintenance_requests(agency_id);
CREATE INDEX idx_maintenance_requests_tenancy ON maintenance_requests(tenancy_id);
CREATE INDEX idx_maintenance_requests_status ON maintenance_requests(agency_id, status);

ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON maintenance_requests
    USING (agency_id = current_setting('app.agency_id')::int);
```

### maintenance_comments

```sql
CREATE TABLE maintenance_comments (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    request_id INTEGER NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),

    comment_type TEXT DEFAULT 'comment',  -- 'comment', 'status_change', 'priority_change'
    content TEXT,

    -- For status/priority changes
    old_value TEXT,
    new_value TEXT,

    -- Visibility
    is_private BOOLEAN DEFAULT false,     -- Hidden from tenants

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_maintenance_comments_agency ON maintenance_comments(agency_id);
CREATE INDEX idx_maintenance_comments_request ON maintenance_comments(request_id);

ALTER TABLE maintenance_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON maintenance_comments
    USING (agency_id = current_setting('app.agency_id')::int);
```

### maintenance_attachments

```sql
CREATE TABLE maintenance_attachments (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    request_id INTEGER REFERENCES maintenance_requests(id) ON DELETE CASCADE,
    comment_id INTEGER REFERENCES maintenance_comments(id) ON DELETE CASCADE,

    file_path TEXT NOT NULL,
    original_filename TEXT,
    file_type TEXT,                       -- 'image', 'document'
    file_size INTEGER,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_maintenance_attachments_agency ON maintenance_attachments(agency_id);
CREATE INDEX idx_maintenance_attachments_request ON maintenance_attachments(request_id);

ALTER TABLE maintenance_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON maintenance_attachments
    USING (agency_id = current_setting('app.agency_id')::int);
```

---

## Supporting Tables

### locations

```sql
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    name TEXT NOT NULL,                   -- 'Sheffield City Centre', 'Broomhill', etc.
    description TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_locations_agency ON locations(agency_id);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON locations
    USING (agency_id = current_setting('app.agency_id')::int);
```

### agency_settings

```sql
CREATE TABLE agency_settings (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id) UNIQUE,

    -- Email Settings
    email_from_name TEXT,
    email_reply_to TEXT,

    -- Payment Reminders
    payment_reminder_days_before INTEGER DEFAULT 7,
    overdue_reminder_frequency INTEGER DEFAULT 3, -- days between overdue reminders

    -- Certificates
    certificate_reminder_days INTEGER DEFAULT 30,

    -- Agreement Templates
    default_tenancy_agreement_id INTEGER,

    -- Public Site
    public_site_enabled BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE agency_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON agency_settings
    USING (agency_id = current_setting('app.agency_id')::int);
```

### agreement_sections

```sql
CREATE TABLE agreement_sections (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),

    section_type TEXT NOT NULL,           -- 'standard', 'landlord_custom'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,

    -- Conditions
    applies_to TEXT,                      -- 'room_only', 'whole_house', 'all'

    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agreement_sections_agency ON agreement_sections(agency_id);

ALTER TABLE agreement_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON agreement_sections
    USING (agency_id = current_setting('app.agency_id')::int);
```

### viewing_requests (Public API)

```sql
CREATE TABLE viewing_requests (
    id SERIAL PRIMARY KEY,
    agency_id INTEGER NOT NULL REFERENCES agencies(id),
    property_id INTEGER NOT NULL REFERENCES properties(id),
    room_id INTEGER REFERENCES rooms(id),

    -- Visitor Details
    visitor_name TEXT NOT NULL,
    visitor_email TEXT NOT NULL,
    visitor_phone TEXT,

    -- Request
    preferred_date DATE,
    preferred_time TEXT,
    message TEXT,

    -- Status
    status TEXT DEFAULT 'pending',        -- 'pending', 'confirmed', 'completed', 'cancelled'

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_viewing_requests_agency ON viewing_requests(agency_id);
CREATE INDEX idx_viewing_requests_property ON viewing_requests(property_id);

ALTER TABLE viewing_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_isolation ON viewing_requests
    USING (agency_id = current_setting('app.agency_id')::int);
```

---

## Global Tables (No RLS)

### certificate_types

```sql
CREATE TABLE certificate_types (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,            -- 'gas_safety', 'epc', 'electrical'
    display_name TEXT NOT NULL,
    description TEXT,
    is_mandatory BOOLEAN DEFAULT true,
    default_validity_months INTEGER DEFAULT 12
);

-- Seed data
INSERT INTO certificate_types (name, display_name, is_mandatory, default_validity_months) VALUES
    ('gas_safety', 'Gas Safety Certificate', true, 12),
    ('epc', 'Energy Performance Certificate', true, 120),
    ('electrical', 'Electrical Installation Condition Report', true, 60),
    ('fire_safety', 'Fire Safety Certificate', false, 12);
```

---

## Entity Relationship Summary

```
agencies (1) ──┬── (*) users
               ├── (*) properties ──── (*) rooms
               │       └── (*) certificates
               │       └── (*) images
               ├── (*) landlords
               ├── (*) applications
               ├── (*) tenancies ──── (*) tenancy_members
               │       │                   └── (*) guarantor_agreements
               │       └── (*) payment_schedules ──── (*) payments
               │       └── (*) maintenance_requests ──── (*) maintenance_comments
               │                                         └── (*) maintenance_attachments
               ├── (*) locations
               ├── (1) agency_settings
               ├── (*) agreement_sections
               └── (*) viewing_requests
```

---

*Data Model Version: 1.0*
*Created: 2026-01-31*
