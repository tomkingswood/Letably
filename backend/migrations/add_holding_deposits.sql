-- Migration: Add holding deposits table
-- Supports holding deposit workflow during application approval

CREATE TABLE IF NOT EXISTS holding_deposits (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL REFERENCES agencies(id),
  application_id INTEGER NOT NULL REFERENCES applications(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_reference VARCHAR(100),
  date_received DATE NOT NULL,
  bedroom_id INTEGER REFERENCES bedrooms(id),
  property_id INTEGER REFERENCES properties(id),
  reservation_days INTEGER,
  reservation_expires_at TIMESTAMPTZ,
  reservation_released BOOLEAN DEFAULT FALSE,
  status VARCHAR(30) NOT NULL DEFAULT 'held',
  applied_to_tenancy_id INTEGER REFERENCES tenancies(id),
  status_changed_at TIMESTAMPTZ,
  status_changed_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_holding_deposits_agency_id ON holding_deposits(agency_id);
CREATE INDEX IF NOT EXISTS idx_holding_deposits_application_id ON holding_deposits(application_id);
CREATE INDEX IF NOT EXISTS idx_holding_deposits_bedroom_id ON holding_deposits(bedroom_id);
CREATE INDEX IF NOT EXISTS idx_holding_deposits_status ON holding_deposits(status);

-- RLS policy (secondary safety net)
ALTER TABLE holding_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY holding_deposits_agency_isolation ON holding_deposits
  USING (agency_id = current_setting('app.agency_id', true)::integer);
