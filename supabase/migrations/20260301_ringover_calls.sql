-- ============================================================
-- SDA Refuge — Ringover Calls Analytics
-- Stockage local des appels Ringover pour analytics
-- ============================================================

-- ============================================================
-- 1. ALTER ringover_connections: champs accueil + sync
-- ============================================================
ALTER TABLE ringover_connections
  ADD COLUMN IF NOT EXISTS accueil_number TEXT,
  ADD COLUMN IF NOT EXISTS accueil_label TEXT,
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_cursor TEXT;

-- ============================================================
-- 2. Table: ringover_calls
-- ============================================================
CREATE TABLE IF NOT EXISTS ringover_calls (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id      UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  ringover_call_id      TEXT NOT NULL,
  direction             TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  status                TEXT NOT NULL,
  caller_number         TEXT,
  caller_name           TEXT,
  callee_number         TEXT,
  callee_name           TEXT,
  agent_id              TEXT,
  agent_name            TEXT,
  start_time            TIMESTAMPTZ NOT NULL,
  end_time              TIMESTAMPTZ,
  duration              INT NOT NULL DEFAULT 0,
  wait_time             INT DEFAULT 0,
  has_voicemail         BOOLEAN DEFAULT false,
  voicemail_url         TEXT,
  has_recording         BOOLEAN DEFAULT false,
  recording_url         TEXT,
  tags                  JSONB DEFAULT '[]',
  notes                 TEXT,
  callback_needed       BOOLEAN DEFAULT false,
  callback_completed    BOOLEAN DEFAULT false,
  callback_completed_at TIMESTAMPTZ,
  callback_completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  callback_notes        TEXT,
  raw_data              JSONB,
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, ringover_call_id)
);

-- ============================================================
-- 3. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ringover_calls_establishment
  ON ringover_calls(establishment_id);
CREATE INDEX IF NOT EXISTS idx_ringover_calls_start_time
  ON ringover_calls(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_ringover_calls_status
  ON ringover_calls(status);
CREATE INDEX IF NOT EXISTS idx_ringover_calls_direction
  ON ringover_calls(direction);
CREATE INDEX IF NOT EXISTS idx_ringover_calls_caller
  ON ringover_calls(caller_number);
CREATE INDEX IF NOT EXISTS idx_ringover_calls_callback
  ON ringover_calls(callback_needed)
  WHERE callback_needed = true AND callback_completed = false;
CREATE INDEX IF NOT EXISTS idx_ringover_calls_analytics
  ON ringover_calls(establishment_id, start_time DESC, status, direction);

-- ============================================================
-- 4. Trigger updated_at
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_ringover_calls_updated') THEN
    CREATE TRIGGER tr_ringover_calls_updated
      BEFORE UPDATE ON ringover_calls
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ============================================================
-- 5. RLS
-- ============================================================
ALTER TABLE ringover_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ringover_calls_select" ON ringover_calls
  FOR SELECT USING (
    establishment_id IN (
      SELECT establishment_id FROM establishment_members
      WHERE user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: via createAdminClient (service_role bypass RLS)

-- ============================================================
-- 6. Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE ringover_calls;

-- ============================================================
-- DONE!
-- ============================================================
