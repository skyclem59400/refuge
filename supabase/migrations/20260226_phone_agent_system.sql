-- ============================================
-- SDA Refuge — Phone Agent System
-- A executer dans Supabase Dashboard → SQL Editor
-- ============================================

-- ============================================
-- 1. CALL CATEGORIES (par etablissement)
-- ============================================
CREATE TABLE IF NOT EXISTS call_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, name)
);

-- Seed par defaut (sera insere manuellement par etablissement)
-- Support, Adoption, Reclamation, Information, Rendez-vous, Animaux perdus, Autre

CREATE INDEX IF NOT EXISTS idx_call_categories_establishment ON call_categories(establishment_id);

-- ============================================
-- 2. AGENT SESSIONS (par etablissement)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'in_call', 'processing')),
  current_call_id UUID,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_establishment ON agent_sessions(establishment_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);

-- ============================================
-- 3. CALL LOGS (par etablissement)
-- ============================================
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  caller_phone TEXT NOT NULL,
  agent_session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
  agent_name TEXT,
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'in_progress', 'completed', 'failed', 'voicemail', 'no_answer')),
  duration_seconds INT DEFAULT 0,

  -- AI-generated fields
  category_id UUID REFERENCES call_categories(id) ON DELETE SET NULL,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  summary TEXT,
  action_items JSONB DEFAULT '[]',

  -- Callback tracking
  callback_needed BOOLEAN DEFAULT false,
  callback_completed BOOLEAN DEFAULT false,
  callback_completed_at TIMESTAMPTZ,
  callback_completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Metadata
  livekit_room_name TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_establishment ON call_logs(establishment_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON call_logs(status);
CREATE INDEX IF NOT EXISTS idx_call_logs_category ON call_logs(category_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created ON call_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_callback ON call_logs(callback_needed) WHERE callback_needed = true AND callback_completed = false;

-- ============================================
-- 4. CALL TRANSCRIPTS
-- ============================================
CREATE TABLE IF NOT EXISTS call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_log_id UUID NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL CHECK (speaker IN ('caller', 'agent')),
  content TEXT NOT NULL,
  timestamp_ms BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_transcripts_call ON call_transcripts(call_log_id);

-- ============================================
-- 5. TRIGGERS updated_at
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_agent_sessions_updated') THEN
    CREATE TRIGGER tr_agent_sessions_updated
      BEFORE UPDATE ON agent_sessions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_call_logs_updated') THEN
    CREATE TRIGGER tr_call_logs_updated
      BEFORE UPDATE ON call_logs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ============================================
-- 6. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE call_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;

-- call_categories: membres de l'etablissement
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'call_categories_select') THEN
    CREATE POLICY "call_categories_select" ON call_categories FOR SELECT USING (
      establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'call_categories_insert') THEN
    CREATE POLICY "call_categories_insert" ON call_categories FOR INSERT WITH CHECK (
      establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'call_categories_update') THEN
    CREATE POLICY "call_categories_update" ON call_categories FOR UPDATE USING (
      establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'call_categories_delete') THEN
    CREATE POLICY "call_categories_delete" ON call_categories FOR DELETE USING (
      establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
    );
  END IF;
END $$;

-- agent_sessions: membres de l'etablissement
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'agent_sessions_select') THEN
    CREATE POLICY "agent_sessions_select" ON agent_sessions FOR SELECT USING (
      establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'agent_sessions_insert') THEN
    CREATE POLICY "agent_sessions_insert" ON agent_sessions FOR INSERT WITH CHECK (
      establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'agent_sessions_update') THEN
    CREATE POLICY "agent_sessions_update" ON agent_sessions FOR UPDATE USING (
      establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
    );
  END IF;
END $$;

-- call_logs: membres de l'etablissement
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'call_logs_select') THEN
    CREATE POLICY "call_logs_select" ON call_logs FOR SELECT USING (
      establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'call_logs_insert') THEN
    CREATE POLICY "call_logs_insert" ON call_logs FOR INSERT WITH CHECK (
      establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'call_logs_update') THEN
    CREATE POLICY "call_logs_update" ON call_logs FOR UPDATE USING (
      establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
    );
  END IF;
END $$;

-- call_transcripts: via call_logs establishment scope
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'call_transcripts_select') THEN
    CREATE POLICY "call_transcripts_select" ON call_transcripts FOR SELECT USING (
      call_log_id IN (SELECT id FROM call_logs WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      ))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'call_transcripts_insert') THEN
    CREATE POLICY "call_transcripts_insert" ON call_transcripts FOR INSERT WITH CHECK (
      call_log_id IN (SELECT id FROM call_logs WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      ))
    );
  END IF;
END $$;

-- ============================================
-- 7. REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE call_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE call_transcripts;

-- ============================================
-- 8. Seed default categories function
-- ============================================
CREATE OR REPLACE FUNCTION seed_call_categories(est_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO call_categories (establishment_id, name, description, color) VALUES
    (est_id, 'Adoption', 'Questions sur les adoptions', '#22c55e'),
    (est_id, 'Animaux perdus', 'Signalements d''animaux perdus ou trouves', '#ef4444'),
    (est_id, 'Information', 'Demandes d''information generale', '#6366f1'),
    (est_id, 'Reclamation', 'Plaintes et problemes', '#f59e0b'),
    (est_id, 'Rendez-vous', 'Prise de rendez-vous', '#8b5cf6'),
    (est_id, 'Don', 'Questions sur les dons', '#ec4899'),
    (est_id, 'Autre', 'Non categorise', '#6b7280')
  ON CONFLICT (establishment_id, name) DO NOTHING;
END;
$$;

-- ============================================
-- DONE! Phone Agent System pour SDA Refuge.
-- ============================================
