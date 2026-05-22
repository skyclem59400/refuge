-- ============================================================
-- Optimus — Enquetes de satisfaction post-action
-- ============================================================
-- Capture le ressenti des adoptants, donateurs et familles d'accueil apres
-- un evenement cle. Methodologie NPS (Net Promoter Score) : 1 note 0-10 +
-- 1 verbatim "qu'est-ce qu'on aurait pu mieux faire ?".
--
-- Workflow :
--   1. Cron quotidienne scan les events eligibles (adoption J+7, don J+1,
--      foster J+7) et cree une survey row avec token unique + envoie email
--   2. Destinataire clique le lien dans le mail : /satisfaction/[token]
--   3. Soumission stocke nps_score + verbatim + completed_at
--   4. Admin consulte le dashboard /admin/satisfaction
--   5. Admin marque "traite" via resolved_at/resolution_notes

CREATE TABLE IF NOT EXISTS satisfaction_surveys (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL CHECK (kind IN ('adoption', 'donation', 'foster')),
  related_id        UUID NOT NULL,
  recipient_name    TEXT,
  recipient_email   TEXT NOT NULL,
  token             TEXT NOT NULL UNIQUE,
  scheduled_for     TIMESTAMPTZ NOT NULL,
  sent_at           TIMESTAMPTZ,
  send_error        TEXT,
  completed_at      TIMESTAMPTZ,
  nps_score         SMALLINT CHECK (nps_score IS NULL OR (nps_score >= 0 AND nps_score <= 10)),
  verbatim          TEXT,
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID REFERENCES auth.users(id),
  resolution_notes  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uniq_survey_related UNIQUE (kind, related_id)
);

CREATE INDEX IF NOT EXISTS idx_surveys_dashboard
  ON satisfaction_surveys(establishment_id, completed_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_surveys_pending_send
  ON satisfaction_surveys(scheduled_for) WHERE sent_at IS NULL;

DROP TRIGGER IF EXISTS tr_satisfaction_surveys_updated ON satisfaction_surveys;
CREATE TRIGGER tr_satisfaction_surveys_updated
  BEFORE UPDATE ON satisfaction_surveys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS : admin du refuge consulte ; soumission publique passe par server action
ALTER TABLE satisfaction_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ssurvey_admin_select" ON satisfaction_surveys FOR SELECT TO authenticated
USING (user_has_permission(establishment_id, 'manage_establishment'));

-- Pas de policy INSERT/UPDATE/DELETE : tout passe par server actions
-- (createAdminClient bypass RLS, securite cote code via token ou permission)
