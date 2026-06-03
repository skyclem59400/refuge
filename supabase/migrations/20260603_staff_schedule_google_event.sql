-- Track the Google Calendar event id synced from each staff schedule entry
ALTER TABLE staff_schedule ADD COLUMN IF NOT EXISTS google_event_id text;
