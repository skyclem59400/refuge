-- ============================================================
-- SDA Estormel — Animals, Boxes, Movements, Health Records
-- Migration: 20260221_sda_animals
-- ============================================================

-- ============================================================
-- 1. ALTER establishments: add type column
-- ============================================================
ALTER TABLE establishments
  ADD COLUMN type TEXT NOT NULL DEFAULT 'farm'
  CHECK (type IN ('farm', 'shelter', 'both'));

-- ============================================================
-- 2. Public holidays (French 2026)
-- ============================================================
CREATE TABLE public_holidays (
  date  DATE PRIMARY KEY,
  label TEXT NOT NULL
);

INSERT INTO public_holidays (date, label) VALUES
  ('2026-01-01', 'Jour de l''An'),
  ('2026-04-06', 'Lundi de Pâques'),
  ('2026-05-01', 'Fête du Travail'),
  ('2026-05-08', 'Victoire 1945'),
  ('2026-05-14', 'Ascension'),
  ('2026-05-25', 'Lundi de Pentecôte'),
  ('2026-07-14', 'Fête nationale'),
  ('2026-08-15', 'Assomption'),
  ('2026-11-01', 'Toussaint'),
  ('2026-11-11', 'Armistice 1918'),
  ('2026-12-25', 'Noël');

-- ============================================================
-- 3. Boxes (enclos / cages)
-- ============================================================
CREATE TABLE boxes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  species_type      TEXT NOT NULL CHECK (species_type IN ('cat', 'dog', 'mixed')),
  capacity          INT NOT NULL DEFAULT 1,
  status            TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. Animals
-- ============================================================
CREATE TABLE animals (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id        UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,

  -- Identity
  name                    TEXT NOT NULL,
  name_secondary          TEXT,
  species                 TEXT NOT NULL CHECK (species IN ('cat', 'dog')),
  breed                   TEXT,
  breed_cross             TEXT,
  sex                     TEXT NOT NULL DEFAULT 'unknown' CHECK (sex IN ('male', 'female', 'unknown')),
  birth_date              DATE,
  birth_place             TEXT,
  color                   TEXT,
  weight                  DECIMAL(5,2),
  sterilized              BOOLEAN NOT NULL DEFAULT false,

  -- Identification
  chip_number             TEXT,
  tattoo_number           TEXT,
  tattoo_position         TEXT,
  medal_number            TEXT,
  loof_number             TEXT,
  passport_number         TEXT,
  icad_updated            BOOLEAN NOT NULL DEFAULT false,

  -- Status & behavior
  status                  TEXT NOT NULL DEFAULT 'pound'
                          CHECK (status IN ('pound', 'shelter', 'adopted', 'returned',
                                            'transferred', 'deceased', 'euthanized')),
  behavior_score          INT CHECK (behavior_score BETWEEN 1 AND 5),
  description             TEXT,

  -- Capture / origin
  capture_location        TEXT,
  capture_circumstances   TEXT,
  origin_type             TEXT CHECK (origin_type IN ('found', 'abandoned', 'transferred_in', 'surrender')),

  -- Box assignment
  box_id                  UUID REFERENCES boxes(id) ON DELETE SET NULL,

  -- Key dates
  pound_entry_date        DATE,
  shelter_entry_date      DATE,
  exit_date               DATE,

  -- Timestamps
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. Animal photos
-- ============================================================
CREATE TABLE animal_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id   UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. Animal movements
-- ============================================================
CREATE TABLE animal_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id       UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN (
                    'pound_entry', 'shelter_transfer', 'adoption',
                    'return_to_owner', 'transfer_out', 'death', 'euthanasia'
                  )),
  date            TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT,
  person_name     TEXT,
  person_contact  TEXT,
  destination     TEXT,
  icad_status     TEXT NOT NULL DEFAULT 'pending'
                  CHECK (icad_status IN ('pending', 'declared', 'not_required')),
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. Animal health records
-- ============================================================
CREATE TABLE animal_health_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id       UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN (
                    'vaccination', 'sterilization', 'antiparasitic',
                    'consultation', 'surgery', 'medication', 'behavioral_assessment'
                  )),
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  description     TEXT,
  veterinarian    TEXT,
  next_due_date   DATE,
  cost            DECIMAL(10,2),
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. Indexes
-- ============================================================

-- Boxes
CREATE INDEX idx_boxes_establishment ON boxes(establishment_id);
CREATE INDEX idx_boxes_status ON boxes(status);

-- Animals
CREATE INDEX idx_animals_establishment ON animals(establishment_id);
CREATE INDEX idx_animals_status ON animals(status);
CREATE INDEX idx_animals_species ON animals(species);
CREATE INDEX idx_animals_chip_number ON animals(chip_number);
CREATE INDEX idx_animals_box ON animals(box_id);

-- Animal photos
CREATE INDEX idx_animal_photos_animal ON animal_photos(animal_id);

-- Animal movements
CREATE INDEX idx_animal_movements_animal ON animal_movements(animal_id);
CREATE INDEX idx_animal_movements_type ON animal_movements(type);

-- Animal health records
CREATE INDEX idx_animal_health_animal ON animal_health_records(animal_id);
CREATE INDEX idx_animal_health_type ON animal_health_records(type);

-- ============================================================
-- 9. Triggers: updated_at on animals and boxes
-- ============================================================
-- update_updated_at() function already exists from 002_establishments.sql

CREATE TRIGGER tr_boxes_updated
  BEFORE UPDATE ON boxes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_animals_updated
  BEFORE UPDATE ON animals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 10. RLS — Enable on all tables, allow authenticated users
-- ============================================================

-- public_holidays: read-only for authenticated
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_holidays_select" ON public_holidays
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- boxes
ALTER TABLE boxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boxes_select" ON boxes
  FOR SELECT USING (
    establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "boxes_insert" ON boxes
  FOR INSERT WITH CHECK (
    establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "boxes_update" ON boxes
  FOR UPDATE USING (
    establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "boxes_delete" ON boxes
  FOR DELETE USING (
    establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  );

-- animals
ALTER TABLE animals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "animals_select" ON animals
  FOR SELECT USING (
    establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "animals_insert" ON animals
  FOR INSERT WITH CHECK (
    establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "animals_update" ON animals
  FOR UPDATE USING (
    establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "animals_delete" ON animals
  FOR DELETE USING (
    establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  );

-- animal_photos
ALTER TABLE animal_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "animal_photos_select" ON animal_photos
  FOR SELECT USING (
    animal_id IN (
      SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "animal_photos_insert" ON animal_photos
  FOR INSERT WITH CHECK (
    animal_id IN (
      SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "animal_photos_update" ON animal_photos
  FOR UPDATE USING (
    animal_id IN (
      SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "animal_photos_delete" ON animal_photos
  FOR DELETE USING (
    animal_id IN (
      SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    )
  );

-- animal_movements
ALTER TABLE animal_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "animal_movements_select" ON animal_movements
  FOR SELECT USING (
    animal_id IN (
      SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "animal_movements_insert" ON animal_movements
  FOR INSERT WITH CHECK (
    animal_id IN (
      SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "animal_movements_update" ON animal_movements
  FOR UPDATE USING (
    animal_id IN (
      SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "animal_movements_delete" ON animal_movements
  FOR DELETE USING (
    animal_id IN (
      SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    )
  );

-- animal_health_records
ALTER TABLE animal_health_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "animal_health_records_select" ON animal_health_records
  FOR SELECT USING (
    animal_id IN (
      SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "animal_health_records_insert" ON animal_health_records
  FOR INSERT WITH CHECK (
    animal_id IN (
      SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "animal_health_records_update" ON animal_health_records
  FOR UPDATE USING (
    animal_id IN (
      SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "animal_health_records_delete" ON animal_health_records
  FOR DELETE USING (
    animal_id IN (
      SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 11. Function: count_business_days
-- ============================================================
CREATE OR REPLACE FUNCTION count_business_days(start_date DATE, end_date DATE)
RETURNS INT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total INT := 0;
  current_date_iter DATE := start_date;
BEGIN
  IF start_date IS NULL OR end_date IS NULL THEN
    RETURN NULL;
  END IF;

  IF start_date > end_date THEN
    RETURN 0;
  END IF;

  WHILE current_date_iter <= end_date LOOP
    -- Exclude weekends (0=Sunday, 6=Saturday in EXTRACT(DOW ...))
    IF EXTRACT(DOW FROM current_date_iter) NOT IN (0, 6) THEN
      -- Exclude public holidays
      IF NOT EXISTS (SELECT 1 FROM public_holidays WHERE public_holidays.date = current_date_iter) THEN
        total := total + 1;
      END IF;
    END IF;
    current_date_iter := current_date_iter + INTERVAL '1 day';
  END LOOP;

  RETURN total;
END;
$$;

-- ============================================================
-- 12. Storage bucket for animal photos
-- ============================================================
-- NOTE: Create the Storage bucket "animal-photos" (public) via
-- the Supabase Dashboard: Storage → New Bucket → "animal-photos" → Public
-- This cannot be done via SQL migration.
