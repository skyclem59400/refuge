-- Add Google Calendar ID to establishments
ALTER TABLE establishments ADD COLUMN IF NOT EXISTS google_calendar_id TEXT DEFAULT '';
