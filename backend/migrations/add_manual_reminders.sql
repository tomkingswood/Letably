-- Migration: Create manual_reminders and reminder_email_notifications tables
-- Run with: psql -f add_manual_reminders.sql

BEGIN;

-- manual_reminders
CREATE TABLE IF NOT EXISTS manual_reminders (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  reminder_date DATE NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'critical')),
  property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_manual_reminders_agency_id ON manual_reminders(agency_id);
CREATE INDEX IF NOT EXISTS idx_manual_reminders_reminder_date ON manual_reminders(reminder_date);

ALTER TABLE manual_reminders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manual_reminders' AND policyname = 'manual_reminders_agency_isolation') THEN
    CREATE POLICY manual_reminders_agency_isolation ON manual_reminders
      USING (agency_id = current_setting('app.current_agency_id', true)::int);
  END IF;
END $$;

-- reminder_email_notifications
CREATE TABLE IF NOT EXISTS reminder_email_notifications (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  reminder_identifier VARCHAR(255) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'critical')),
  recipient_email VARCHAR(255) NOT NULL,
  last_emailed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(reminder_identifier, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_reminder_email_notif_agency ON reminder_email_notifications(agency_id);
CREATE INDEX IF NOT EXISTS idx_reminder_email_notif_lookup ON reminder_email_notifications(recipient_email, agency_id);

ALTER TABLE reminder_email_notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reminder_email_notifications' AND policyname = 'reminder_email_notif_agency_isolation') THEN
    CREATE POLICY reminder_email_notif_agency_isolation ON reminder_email_notifications
      USING (agency_id = current_setting('app.current_agency_id', true)::int);
  END IF;
END $$;

COMMIT;
