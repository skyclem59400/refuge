-- ============================================================
-- Partenaires externes pour les sorties (Akéla = éducatrice canine, etc.)
-- ============================================================
-- Permet d'assigner un chien à un partenaire externe au refuge (pas un
-- membre de l'équipe) pour ses sorties / sessions de travail.
-- Akéla est seedée d'office pour SDA Estourmel.

CREATE TABLE IF NOT EXISTS outing_partners (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id    UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  -- 'educator' (éducateur canin), 'club' (club canin), 'walker' (promeneur pro),
  -- 'foster_pro' (FA pro), 'other'
  kind                TEXT NOT NULL DEFAULT 'educator' CHECK (kind IN ('educator', 'club', 'walker', 'foster_pro', 'other')),
  -- Couleur/badge à afficher à côté du nom dans le picker / la liste sorties
  default_outing_label TEXT,
  contact_phone       TEXT,
  contact_email       TEXT,
  notes               TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outing_partners_estab ON outing_partners(establishment_id, is_active);

CREATE OR REPLACE FUNCTION outing_partners_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_outing_partners_updated ON outing_partners;
CREATE TRIGGER trg_outing_partners_updated
  BEFORE UPDATE ON outing_partners
  FOR EACH ROW EXECUTE FUNCTION outing_partners_set_updated_at();

ALTER TABLE outing_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outing_partners_select" ON outing_partners;
DROP POLICY IF EXISTS "outing_partners_insert" ON outing_partners;
DROP POLICY IF EXISTS "outing_partners_update" ON outing_partners;
DROP POLICY IF EXISTS "outing_partners_delete" ON outing_partners;

CREATE POLICY "outing_partners_select" ON outing_partners FOR SELECT USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "outing_partners_insert" ON outing_partners FOR INSERT WITH CHECK (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "outing_partners_update" ON outing_partners FOR UPDATE USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "outing_partners_delete" ON outing_partners FOR DELETE USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);

-- ============================================================
-- Adapt outing_assignments : assigned_to OR partner_id
-- ============================================================
-- Soit on assigne à un membre (assigned_to), soit à un partenaire externe (partner_id).
-- Exactement un des deux est non-null.

ALTER TABLE outing_assignments
  ALTER COLUMN assigned_to DROP NOT NULL;

ALTER TABLE outing_assignments
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES outing_partners(id) ON DELETE CASCADE;

-- CHECK : exactement un des deux non-null
ALTER TABLE outing_assignments
  DROP CONSTRAINT IF EXISTS outing_assignments_assignee_check;
ALTER TABLE outing_assignments
  ADD CONSTRAINT outing_assignments_assignee_check
  CHECK ((assigned_to IS NOT NULL AND partner_id IS NULL) OR (assigned_to IS NULL AND partner_id IS NOT NULL));

-- Remplace la unique sur (animal_id, assigned_to, date) par 2 uniques partielles
ALTER TABLE outing_assignments
  DROP CONSTRAINT IF EXISTS outing_assignments_animal_id_assigned_to_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_outing_assignments_animal_user_date
  ON outing_assignments(animal_id, assigned_to, date)
  WHERE assigned_to IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_outing_assignments_animal_partner_date
  ON outing_assignments(animal_id, partner_id, date)
  WHERE partner_id IS NOT NULL;

-- ============================================================
-- Seed Akéla pour SDA Estourmel
-- ============================================================
INSERT INTO outing_partners (establishment_id, name, kind, default_outing_label, notes)
SELECT id, 'Akéla', 'educator', 'Canicross', 'Éducatrice canine partenaire. Sorties canicross / sessions de travail avec ses propres clients.'
FROM establishments WHERE name ILIKE 'SDA' AND NOT EXISTS (
  SELECT 1 FROM outing_partners op
  WHERE op.establishment_id = establishments.id AND op.name = 'Akéla'
);
