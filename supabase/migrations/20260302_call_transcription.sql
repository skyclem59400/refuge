-- ============================================================
-- SDA Refuge — Call Transcription & AI Summary
-- Adds transcription/summary columns to ringover_calls
-- ============================================================

ALTER TABLE ringover_calls
  ADD COLUMN IF NOT EXISTS transcript TEXT,
  ADD COLUMN IF NOT EXISTS transcript_language TEXT DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_sentiment TEXT CHECK (ai_sentiment IN ('positive', 'neutral', 'negative')),
  ADD COLUMN IF NOT EXISTS ai_action_items JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS transcribed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transcribed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ringover_calls_transcribed
  ON ringover_calls(transcribed_at) WHERE transcribed_at IS NOT NULL;
