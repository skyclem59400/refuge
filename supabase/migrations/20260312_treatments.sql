-- ============================================================
-- SDA Refuge — Traitements animaux
-- Migration: 20260312_treatments
-- Gestion des traitements récurrents avec validation quotidienne
-- ============================================================

-- ============================================================
-- 1. Table: animal_treatments
-- ============================================================
CREATE TABLE IF NOT EXISTS animal_treatments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  animal_id         UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  health_record_id  UUID REFERENCES animal_health_records(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  frequency         TEXT NOT NULL DEFAULT 'daily'
                    CHECK (frequency IN ('daily', 'twice_daily', 'weekly', 'custom')),
  times             TEXT[] DEFAULT '{}',
  start_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date          DATE,
  active            BOOLEAN NOT NULL DEFAULT true,
  notes             TEXT,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Table: treatment_administrations
-- ============================================================
CREATE TABLE IF NOT EXISTS treatment_administrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id    UUID NOT NULL REFERENCES animal_treatments(id) ON DELETE CASCADE,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  time_slot       TEXT,
  administered_by UUID NOT NULL REFERENCES auth.users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_treatments_establishment_active
  ON animal_treatments(establishment_id, active, start_date);

CREATE INDEX IF NOT EXISTS idx_treatments_animal
  ON animal_treatments(animal_id);

CREATE INDEX IF NOT EXISTS idx_treatments_health_record
  ON animal_treatments(health_record_id)
  WHERE health_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_administrations_treatment_date
  ON treatment_administrations(treatment_id, date);

CREATE INDEX IF NOT EXISTS idx_administrations_date
  ON treatment_administrations(date);

-- Unique constraint: one administration per treatment per date per time slot
CREATE UNIQUE INDEX IF NOT EXISTS idx_administrations_unique
  ON treatment_administrations(treatment_id, date, COALESCE(time_slot, ''));

-- ============================================================
-- 4. Trigger updated_at
-- ============================================================
CREATE TRIGGER tr_treatments_updated
  BEFORE UPDATE ON animal_treatments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 5. RLS policies
-- ============================================================
ALTER TABLE animal_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_administrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Treatments: members can view
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'treatments_select') THEN
    CREATE POLICY "treatments_select" ON animal_treatments FOR SELECT USING (
      establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    );
  END IF;

  -- Treatments: manage_health can insert
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'treatments_insert') THEN
    CREATE POLICY "treatments_insert" ON animal_treatments FOR INSERT WITH CHECK (
      user_has_permission(establishment_id, 'manage_health')
    );
  END IF;

  -- Treatments: manage_health can update
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'treatments_update') THEN
    CREATE POLICY "treatments_update" ON animal_treatments FOR UPDATE USING (
      user_has_permission(establishment_id, 'manage_health')
    );
  END IF;

  -- Treatments: manage_health can delete
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'treatments_delete') THEN
    CREATE POLICY "treatments_delete" ON animal_treatments FOR DELETE USING (
      user_has_permission(establishment_id, 'manage_health')
    );
  END IF;

  -- Administrations: members can view
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'administrations_select') THEN
    CREATE POLICY "administrations_select" ON treatment_administrations FOR SELECT USING (
      treatment_id IN (
        SELECT id FROM animal_treatments WHERE establishment_id IN (
          SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
        )
      )
    );
  END IF;

  -- Administrations: any member can insert (validate a treatment)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'administrations_insert') THEN
    CREATE POLICY "administrations_insert" ON treatment_administrations FOR INSERT WITH CHECK (
      treatment_id IN (
        SELECT id FROM animal_treatments WHERE establishment_id IN (
          SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
        )
      )
    );
  END IF;

  -- Administrations: manage_health can delete (cancel an administration)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'administrations_delete') THEN
    CREATE POLICY "administrations_delete" ON treatment_administrations FOR DELETE USING (
      treatment_id IN (
        SELECT id FROM animal_treatments WHERE establishment_id IN (
          SELECT establishment_id FROM establishment_members
          WHERE user_id = auth.uid()
        )
      )
      AND user_has_permission(
        (SELECT establishment_id FROM animal_treatments WHERE id = treatment_id),
        'manage_health'
      )
    );
  END IF;
END $$;

-- ============================================================
-- DONE! Treatments schema ready.
-- ============================================================
