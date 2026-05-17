-- ============================================================
-- Système de parrainage d'animaux
-- ============================================================
-- Un parrainage = relation continue entre un client (parrain) et un animal.
-- Peut être financier (don récurrent), ponctuel ou symbolique (lien moral).
-- Un animal peut avoir plusieurs parrains, un parrain peut avoir plusieurs filleuls.
-- Les dons rattachés pointent vers le sponsorship via donations.sponsorship_id.
-- Quand l'animal sort (adopté/décédé/transféré), un trigger ferme automatiquement
-- les parrainages actifs avec une raison adaptée.

CREATE TABLE IF NOT EXISTS sponsorships (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id    UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  animal_id           UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  -- 'active' : parrainage en cours
  -- 'pending' : créé mais pas encore commencé / en attente premier don
  -- 'ended' : terminé (par sortie animal ou résiliation parrain)
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'ended')),
  -- 'financial_monthly' : engagement mensuel (don récurrent)
  -- 'financial_punctual' : dons ponctuels fléchés
  -- 'symbolic' : pas de flux financier, juste lien moral / visites
  kind                TEXT NOT NULL DEFAULT 'financial_monthly' CHECK (kind IN ('financial_monthly', 'financial_punctual', 'symbolic')),
  -- Montant indicatif si financier (peut être différent du don réel)
  monthly_amount      NUMERIC(8, 2),
  started_at          DATE NOT NULL DEFAULT CURRENT_DATE,
  ended_at            DATE,
  ended_reason        TEXT CHECK (ended_reason IN ('animal_adopted', 'animal_deceased', 'animal_transferred', 'animal_returned', 'sponsor_cancelled', 'sponsor_deceased', 'other')),
  -- Pour affichage public si autorisé (sinon nom client par défaut)
  public_alias        TEXT,
  -- Consentement RGPD : afficher le parrain sur le portail public
  show_publicly       BOOLEAN NOT NULL DEFAULT false,
  notes               TEXT,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsorships_animal ON sponsorships(animal_id);
CREATE INDEX IF NOT EXISTS idx_sponsorships_client ON sponsorships(client_id);
CREATE INDEX IF NOT EXISTS idx_sponsorships_estab_status ON sponsorships(establishment_id, status);
CREATE INDEX IF NOT EXISTS idx_sponsorships_public ON sponsorships(animal_id) WHERE show_publicly = true AND status = 'active';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION sponsorships_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sponsorships_updated ON sponsorships;
CREATE TRIGGER trg_sponsorships_updated
  BEFORE UPDATE ON sponsorships
  FOR EACH ROW EXECUTE FUNCTION sponsorships_set_updated_at();

-- ============================================================
-- Trigger auto-fermeture quand l'animal sort
-- ============================================================
-- Statuts de sortie : adopted, returned, transferred, deceased, euthanized
-- Mappe le statut sortie vers le ended_reason adapté.
CREATE OR REPLACE FUNCTION close_sponsorships_on_animal_exit()
RETURNS TRIGGER AS $$
DECLARE
  v_reason TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Si le nouveau statut n'est pas un statut de sortie, rien à faire
  IF NEW.status NOT IN ('adopted', 'returned', 'transferred', 'deceased', 'euthanized') THEN
    RETURN NEW;
  END IF;

  v_reason := CASE NEW.status
    WHEN 'adopted'      THEN 'animal_adopted'
    WHEN 'returned'     THEN 'animal_returned'
    WHEN 'transferred'  THEN 'animal_transferred'
    WHEN 'deceased'     THEN 'animal_deceased'
    WHEN 'euthanized'   THEN 'animal_deceased'
  END;

  UPDATE sponsorships
  SET status = 'ended',
      ended_at = COALESCE(NEW.exit_date, CURRENT_DATE),
      ended_reason = v_reason,
      updated_at = now()
  WHERE animal_id = NEW.id
    AND status IN ('active', 'pending');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_close_sponsorships_on_exit ON animals;
CREATE TRIGGER trg_close_sponsorships_on_exit
  AFTER UPDATE OF status ON animals
  FOR EACH ROW
  EXECUTE FUNCTION close_sponsorships_on_animal_exit();

-- ============================================================
-- Lien donations → sponsorship
-- ============================================================
-- Un don peut être fléché sur un parrainage spécifique (versement mensuel ou ponctuel
-- d'un parrain pour son filleul). Si NULL, c'est un don ordinaire.
ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS sponsorship_id UUID REFERENCES sponsorships(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_donations_sponsorship ON donations(sponsorship_id) WHERE sponsorship_id IS NOT NULL;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE sponsorships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sponsorships_select" ON sponsorships;
DROP POLICY IF EXISTS "sponsorships_insert" ON sponsorships;
DROP POLICY IF EXISTS "sponsorships_update" ON sponsorships;
DROP POLICY IF EXISTS "sponsorships_delete" ON sponsorships;

CREATE POLICY "sponsorships_select" ON sponsorships FOR SELECT USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "sponsorships_insert" ON sponsorships FOR INSERT WITH CHECK (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "sponsorships_update" ON sponsorships FOR UPDATE USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "sponsorships_delete" ON sponsorships FOR DELETE USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
