-- ============================================================
-- SDA Refuge — Fix recording/voicemail URLs from raw_data
-- The sync code was previously not extracting URLs from raw_data.
-- The Ringover API stores recording URLs in raw_data->>'record'
-- and voicemail URLs in raw_data->>'voicemail'.
-- ============================================================

-- Fix recording_url: extract from raw_data->>'record' where it's an HTTP URL
UPDATE ringover_calls
SET recording_url = raw_data->>'record'
WHERE has_recording = true
  AND recording_url IS NULL
  AND raw_data->>'record' IS NOT NULL
  AND raw_data->>'record' LIKE 'http%';

-- Fix voicemail_url: extract from raw_data->>'voicemail' where it's an HTTP URL
UPDATE ringover_calls
SET voicemail_url = raw_data->>'voicemail'
WHERE has_voicemail = true
  AND voicemail_url IS NULL
  AND raw_data->>'voicemail' IS NOT NULL
  AND raw_data->>'voicemail' LIKE 'http%';
