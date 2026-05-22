-- ============================================================
-- Optimus — CRA : Astreintes hebdomadaires
-- ============================================================
-- Une astreinte = un collaborateur de garde pour une semaine entiere (lundi -> lundi).
-- Forfait gere par le comptable cote paie (le SaaS ne calcule pas le montant).
-- Regle stricte : une seule personne assignee par semaine et par etablissement.
-- La semaine est rattachee au mois de son lundi de debut (pour le CRA mensuel).

CREATE TABLE IF NOT EXISTS cra_astreintes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id          UUID NOT NULL REFERENCES establishment_members(id) ON DELETE CASCADE,
  establishment_id   UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  week_start_monday  DATE NOT NULL,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         UUID REFERENCES auth.users(id),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ca_is_monday CHECK (EXTRACT(ISODOW FROM week_start_monday) = 1)
);

-- Strict : une seule personne d'astreinte par semaine et par etablissement
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ca_week
  ON cra_astreintes(establishment_id, week_start_monday);

CREATE INDEX IF NOT EXISTS idx_ca_member ON cra_astreintes(member_id, week_start_monday);

DROP TRIGGER IF EXISTS tr_ca_updated ON cra_astreintes;
CREATE TRIGGER tr_ca_updated
  BEFORE UPDATE ON cra_astreintes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS : un user voit ses astreintes + les managers voient toutes
ALTER TABLE cra_astreintes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ca_select" ON cra_astreintes FOR SELECT TO authenticated
USING (
  member_id IN (SELECT id FROM establishment_members WHERE user_id = auth.uid())
  OR user_has_permission(establishment_id, 'manage_leaves')
);

-- Pas de policy INSERT/UPDATE/DELETE : ecritures via server actions (createAdminClient)
