-- ============================================================
-- Optimus — Module CRA (Compte-Rendu d'Activite)
-- ============================================================
-- 3 nouvelles tables :
--   1. member_work_schedules : semaine type d'un salarie (reference)
--   2. cra_entries           : surcharge d'un jour (heures reelles saisies)
--   3. cra_monthly_status    : workflow draft/submitted/validated/sent par mois
--   4. cra_change_requests   : audit des demandes de modification (collab -> Mary, Clement notifie)
-- + extension establishments : accountant_email/name

-- ============================================================
-- 0. Extension establishments
-- ============================================================
ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS accountant_email TEXT,
  ADD COLUMN IF NOT EXISTS accountant_name  TEXT;

-- ============================================================
-- 1. Semaine type (template horaire reference)
-- ============================================================
CREATE TABLE IF NOT EXISTS member_work_schedules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        UUID NOT NULL REFERENCES establishment_members(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  day_of_week      SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=dim, 6=sam
  is_rest_day      BOOLEAN NOT NULL DEFAULT FALSE,
  start_am         TIME,
  end_am           TIME,
  start_pm         TIME,
  end_pm           TIME,
  valid_from       DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until      DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mws_day_consistency CHECK (
    (is_rest_day AND start_am IS NULL AND end_am IS NULL AND start_pm IS NULL AND end_pm IS NULL)
    OR (NOT is_rest_day AND start_am IS NOT NULL AND end_am IS NOT NULL)
  ),
  CONSTRAINT mws_max_17 CHECK (
    (end_am IS NULL OR end_am <= '17:00'::time)
    AND (end_pm IS NULL OR end_pm <= '17:00'::time)
  ),
  CONSTRAINT mws_times_ordered CHECK (
    (start_am IS NULL OR end_am IS NULL OR end_am > start_am)
    AND (start_pm IS NULL OR end_pm IS NULL OR end_pm > start_pm)
    AND (end_am IS NULL OR start_pm IS NULL OR start_pm >= end_am)
  )
);

CREATE INDEX IF NOT EXISTS idx_mws_member ON member_work_schedules(member_id, valid_from);
-- Un seul template courant par (member, day)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_mws_current
  ON member_work_schedules(member_id, day_of_week)
  WHERE valid_until IS NULL;

-- ============================================================
-- 2. CRA entries (surcharges journalieres)
-- ============================================================
CREATE TABLE IF NOT EXISTS cra_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        UUID NOT NULL REFERENCES establishment_members(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  is_rest_day      BOOLEAN NOT NULL DEFAULT FALSE,
  start_am         TIME,
  end_am           TIME,
  start_pm         TIME,
  end_pm           TIME,
  hours_total      NUMERIC(4,2) GENERATED ALWAYS AS (
    COALESCE(EXTRACT(EPOCH FROM (end_am - start_am)) / 3600.0, 0)
    + COALESCE(EXTRACT(EPOCH FROM (end_pm - start_pm)) / 3600.0, 0)
  ) STORED,
  notes            TEXT,
  entered_by       UUID REFERENCES auth.users(id),
  entered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, date),
  CONSTRAINT ce_day_consistency CHECK (
    (is_rest_day AND start_am IS NULL AND end_am IS NULL AND start_pm IS NULL AND end_pm IS NULL)
    OR (NOT is_rest_day)
  ),
  CONSTRAINT ce_max_17 CHECK (
    (end_am IS NULL OR end_am <= '17:00'::time)
    AND (end_pm IS NULL OR end_pm <= '17:00'::time)
  ),
  CONSTRAINT ce_times_ordered CHECK (
    (start_am IS NULL OR end_am IS NULL OR end_am > start_am)
    AND (start_pm IS NULL OR end_pm IS NULL OR end_pm > start_pm)
    AND (end_am IS NULL OR start_pm IS NULL OR start_pm >= end_am)
  )
);

CREATE INDEX IF NOT EXISTS idx_ce_member_date ON cra_entries(member_id, date);
CREATE INDEX IF NOT EXISTS idx_ce_est_date    ON cra_entries(establishment_id, date);

-- ============================================================
-- 3. Statut mensuel + audit workflow
-- ============================================================
CREATE TABLE IF NOT EXISTS cra_monthly_status (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id               UUID NOT NULL REFERENCES establishment_members(id) ON DELETE CASCADE,
  establishment_id        UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  year                    SMALLINT NOT NULL,
  month                   SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  status                  TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'validated_by_member', 'change_requested', 'sent')),
  submitted_at            TIMESTAMPTZ,
  submitted_by            UUID REFERENCES auth.users(id),
  validated_at            TIMESTAMPTZ,
  validated_by            UUID REFERENCES auth.users(id),
  change_requested_at     TIMESTAMPTZ,
  change_request_comment  TEXT,
  sent_at                 TIMESTAMPTZ,
  sent_by                 UUID REFERENCES auth.users(id),
  sent_to                 TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_cms_member_period ON cra_monthly_status(member_id, year, month);
CREATE INDEX IF NOT EXISTS idx_cms_est_status    ON cra_monthly_status(establishment_id, status);

-- ============================================================
-- 4. Audit demandes de modification
-- ============================================================
CREATE TABLE IF NOT EXISTS cra_change_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cra_status_id     UUID NOT NULL REFERENCES cra_monthly_status(id) ON DELETE CASCADE,
  member_id         UUID NOT NULL REFERENCES establishment_members(id) ON DELETE CASCADE,
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_by      UUID REFERENCES auth.users(id),
  comment           TEXT NOT NULL,
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID REFERENCES auth.users(id),
  resolution_notes  TEXT
);

CREATE INDEX IF NOT EXISTS idx_ccr_member ON cra_change_requests(member_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_ccr_status ON cra_change_requests(cra_status_id);

-- ============================================================
-- 5. Triggers updated_at
-- ============================================================
DROP TRIGGER IF EXISTS tr_mws_updated ON member_work_schedules;
CREATE TRIGGER tr_mws_updated
  BEFORE UPDATE ON member_work_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_ce_updated ON cra_entries;
CREATE TRIGGER tr_ce_updated
  BEFORE UPDATE ON cra_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_cms_updated ON cra_monthly_status;
CREATE TRIGGER tr_cms_updated
  BEFORE UPDATE ON cra_monthly_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 6. RLS — alignement sur le pattern leave_requests
-- ============================================================
ALTER TABLE member_work_schedules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cra_entries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cra_monthly_status     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cra_change_requests    ENABLE ROW LEVEL SECURITY;

-- member_work_schedules : un user voit son template + les managers voient tout
CREATE POLICY "mws_select" ON member_work_schedules FOR SELECT TO authenticated
USING (
  member_id IN (SELECT id FROM establishment_members WHERE user_id = auth.uid())
  OR user_has_permission(establishment_id, 'manage_leaves')
);

-- cra_entries : idem
CREATE POLICY "ce_select" ON cra_entries FOR SELECT TO authenticated
USING (
  member_id IN (SELECT id FROM establishment_members WHERE user_id = auth.uid())
  OR user_has_permission(establishment_id, 'manage_leaves')
);

-- cra_monthly_status : un user voit son statut + managers voient tout
CREATE POLICY "cms_select" ON cra_monthly_status FOR SELECT TO authenticated
USING (
  member_id IN (SELECT id FROM establishment_members WHERE user_id = auth.uid())
  OR user_has_permission(establishment_id, 'manage_leaves')
);

-- cra_change_requests : idem
CREATE POLICY "ccr_select" ON cra_change_requests FOR SELECT TO authenticated
USING (
  member_id IN (SELECT id FROM establishment_members WHERE user_id = auth.uid())
  OR user_has_permission(establishment_id, 'manage_leaves')
);

-- Pas de policy INSERT/UPDATE/DELETE : toutes les ecritures passent par les server actions
-- (createAdminClient bypass RLS, requirePermission contrôle l'acces côté code)
