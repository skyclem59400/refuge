-- ============================================================
-- Audit quotidien : table d'historique des runs + bucket stockage
-- ============================================================
-- Trace chaque generation d'audit (auto via cron OU manuelle via
-- bouton super admin). Stocke le PDF dans un bucket prive, l'analyse
-- IA en texte, les stats agregees pour suivi historique.
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_date DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_source TEXT NOT NULL CHECK (trigger_source IN ('cron', 'manual')),

  -- PDF
  pdf_storage_path TEXT,
  pdf_file_name TEXT,
  pdf_size_bytes BIGINT,

  -- Analyse IA
  ai_summary TEXT,
  ai_model TEXT,
  ai_tokens_input INTEGER,
  ai_tokens_output INTEGER,
  ai_tokens_cache_read INTEGER,
  ai_error TEXT,

  -- Snapshot stats par etablissement (JSON)
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Envoi mail
  sent_to TEXT,
  sent_at TIMESTAMPTZ,
  send_error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_audit_runs_date
  ON daily_audit_runs(audit_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_audit_runs_user
  ON daily_audit_runs(generated_by_user_id, generated_at DESC)
  WHERE generated_by_user_id IS NOT NULL;

COMMENT ON TABLE daily_audit_runs IS
  'Historique des audits quotidiens generes (cron ou manuel super admin).';

-- Bucket prive pour stockage des PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audit-reports',
  'audit-reports',
  false,
  10485760,  -- 10 MB par audit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS : seuls les admins peuvent lire l'historique
ALTER TABLE daily_audit_runs ENABLE ROW LEVEL SECURITY;

-- Lecture : tout admin (membre avec role admin dans son groupe systeme)
DROP POLICY IF EXISTS daily_audit_runs_admin_read ON daily_audit_runs;
CREATE POLICY daily_audit_runs_admin_read ON daily_audit_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM establishment_members em
      JOIN member_groups mg ON mg.member_id = em.id
      JOIN permission_groups pg ON pg.id = mg.group_id
      WHERE em.user_id = auth.uid()
        AND pg.is_system = true
        AND pg.name = 'Administrateur'
    )
  );

-- Insert / update : via service_role uniquement (server actions / cron)

-- Storage RLS : seuls les admins peuvent telecharger les PDFs
DROP POLICY IF EXISTS audit_reports_admin_select ON storage.objects;
CREATE POLICY audit_reports_admin_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'audit-reports'
    AND EXISTS (
      SELECT 1 FROM establishment_members em
      JOIN member_groups mg ON mg.member_id = em.id
      JOIN permission_groups pg ON pg.id = mg.group_id
      WHERE em.user_id = auth.uid()
        AND pg.is_system = true
        AND pg.name = 'Administrateur'
    )
  );
