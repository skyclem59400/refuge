-- ============================================================
-- SDA Refuge — Setup Donations + I-CAD tables
-- À exécuter dans Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 0. Fonction update_updated_at (si elle n'existe pas déjà)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. Table donations
-- ============================================================
CREATE TABLE IF NOT EXISTS donations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,

  -- Donor info
  donor_name        TEXT NOT NULL,
  donor_email       TEXT,
  donor_phone       TEXT,
  donor_address     TEXT,
  donor_postal_code TEXT,
  donor_city        TEXT,

  -- Donation details
  amount            DECIMAL(10,2) NOT NULL,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method    TEXT NOT NULL DEFAULT 'cheque'
                    CHECK (payment_method IN ('cheque', 'virement', 'especes', 'cb', 'prelevement', 'autre')),
  nature            TEXT NOT NULL DEFAULT 'numeraire'
                    CHECK (nature IN ('numeraire', 'nature')),

  -- CERFA receipt
  cerfa_number      TEXT,
  cerfa_generated   BOOLEAN NOT NULL DEFAULT false,
  cerfa_generated_at TIMESTAMPTZ,

  -- Metadata
  notes             TEXT,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Fonction auto-numérotation CERFA
-- ============================================================
CREATE OR REPLACE FUNCTION get_next_cerfa_number(est_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  current_year TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  next_num INT;
  result TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(cerfa_number, '-', 3) AS INT)
  ), 0) + 1
  INTO next_num
  FROM donations
  WHERE establishment_id = est_id
    AND cerfa_number LIKE 'CERFA-' || current_year || '-%';

  result := 'CERFA-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN result;
END;
$$;

-- ============================================================
-- 3. Index donations
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_donations_establishment ON donations(establishment_id);
CREATE INDEX IF NOT EXISTS idx_donations_date ON donations(date);
CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_name);
CREATE INDEX IF NOT EXISTS idx_donations_cerfa ON donations(cerfa_number);

-- ============================================================
-- 4. Trigger updated_at donations
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_donations_updated') THEN
    CREATE TRIGGER tr_donations_updated
      BEFORE UPDATE ON donations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ============================================================
-- 5. RLS donations
-- ============================================================
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'donations_select') THEN
    CREATE POLICY "donations_select" ON donations FOR SELECT USING (
      establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'donations_insert') THEN
    CREATE POLICY "donations_insert" ON donations FOR INSERT WITH CHECK (
      establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'donations_update') THEN
    CREATE POLICY "donations_update" ON donations FOR UPDATE USING (
      establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'donations_delete') THEN
    CREATE POLICY "donations_delete" ON donations FOR DELETE USING (
      establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- ============================================================
-- 6. Table animal_movements (requise par icad_declarations)
-- ============================================================
CREATE TABLE IF NOT EXISTS animal_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id       UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN (
                    'pound_entry', 'shelter_transfer', 'adoption',
                    'return_to_owner', 'transfer_out', 'death', 'euthanasia'
                  )),
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_animal_movements_animal ON animal_movements(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_movements_type ON animal_movements(type);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_animal_movements_updated') THEN
    CREATE TRIGGER tr_animal_movements_updated
      BEFORE UPDATE ON animal_movements
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

ALTER TABLE animal_movements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'animal_movements_select') THEN
    CREATE POLICY "animal_movements_select" ON animal_movements FOR SELECT USING (
      animal_id IN (SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      ))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'animal_movements_insert') THEN
    CREATE POLICY "animal_movements_insert" ON animal_movements FOR INSERT WITH CHECK (
      animal_id IN (SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      ))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'animal_movements_update') THEN
    CREATE POLICY "animal_movements_update" ON animal_movements FOR UPDATE USING (
      animal_id IN (SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      ))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'animal_movements_delete') THEN
    CREATE POLICY "animal_movements_delete" ON animal_movements FOR DELETE USING (
      animal_id IN (SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      ))
    );
  END IF;
END $$;

-- ============================================================
-- 7. Colonne icad_updated sur animals (si manquante)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'animals' AND column_name = 'icad_updated'
  ) THEN
    ALTER TABLE animals ADD COLUMN icad_updated BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- 8. Table icad_declarations
-- ============================================================
CREATE TABLE IF NOT EXISTS icad_declarations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id         UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  movement_id       UUID REFERENCES animal_movements(id) ON DELETE SET NULL,

  -- Declaration details
  declaration_type  TEXT NOT NULL CHECK (declaration_type IN (
    'pound_entry', 'shelter_transfer', 'adoption',
    'return_to_owner', 'transfer_out', 'death', 'euthanasia',
    'identification', 'owner_change', 'address_change'
  )),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'submitted', 'confirmed', 'rejected', 'error', 'not_required'
  )),

  -- I-CAD reference
  icad_reference    TEXT,
  submitted_at      TIMESTAMPTZ,
  confirmed_at      TIMESTAMPTZ,

  -- Error tracking
  error_message     TEXT,
  retry_count       INT NOT NULL DEFAULT 0,

  -- Metadata
  notes             TEXT,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 9. Index icad_declarations
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_icad_animal ON icad_declarations(animal_id);
CREATE INDEX IF NOT EXISTS idx_icad_status ON icad_declarations(status);
CREATE INDEX IF NOT EXISTS idx_icad_movement ON icad_declarations(movement_id);
CREATE INDEX IF NOT EXISTS idx_icad_type ON icad_declarations(declaration_type);

-- ============================================================
-- 10. Trigger updated_at icad_declarations
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_icad_declarations_updated') THEN
    CREATE TRIGGER tr_icad_declarations_updated
      BEFORE UPDATE ON icad_declarations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ============================================================
-- 11. RLS icad_declarations
-- ============================================================
ALTER TABLE icad_declarations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'icad_declarations_select') THEN
    CREATE POLICY "icad_declarations_select" ON icad_declarations FOR SELECT USING (
      animal_id IN (
        SELECT id FROM animals WHERE establishment_id IN (
          SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
        )
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'icad_declarations_insert') THEN
    CREATE POLICY "icad_declarations_insert" ON icad_declarations FOR INSERT WITH CHECK (
      animal_id IN (
        SELECT id FROM animals WHERE establishment_id IN (
          SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
        )
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'icad_declarations_update') THEN
    CREATE POLICY "icad_declarations_update" ON icad_declarations FOR UPDATE USING (
      animal_id IN (
        SELECT id FROM animals WHERE establishment_id IN (
          SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
        )
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'icad_declarations_delete') THEN
    CREATE POLICY "icad_declarations_delete" ON icad_declarations FOR DELETE USING (
      animal_id IN (
        SELECT id FROM animals WHERE establishment_id IN (
          SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
        )
      )
    );
  END IF;
END $$;

-- ============================================================
-- 12. Mise à jour contrainte origin_type sur animals
-- ============================================================
DO $$ BEGIN
  -- Drop l'ancienne contrainte si elle existe
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'animals'::regclass
    AND conname LIKE '%origin_type%'
  ) THEN
    ALTER TABLE animals DROP CONSTRAINT IF EXISTS animals_origin_type_check;
  END IF;

  -- Ajouter la nouvelle contrainte avec requisition et divagation
  ALTER TABLE animals ADD CONSTRAINT animals_origin_type_check
    CHECK (origin_type IN ('found', 'abandoned', 'transferred_in', 'surrender', 'requisition', 'divagation'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================================
-- DONE ! Donations, I-CAD et nouvelles origines sont en place.
-- ============================================================
