-- ============================================================
-- SDA Refuge — Animal Outings (Sorties / Promenades)
-- Migration: 20260227_animal_outings
-- A executer dans Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. Table: animal_outings
-- ============================================================
CREATE TABLE IF NOT EXISTS animal_outings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id         UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  walked_by         UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at          TIMESTAMPTZ,
  duration_minutes  INT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Indexes
-- ============================================================

-- Primary: "last outing per animal" query
CREATE INDEX IF NOT EXISTS idx_animal_outings_animal_date
  ON animal_outings(animal_id, started_at DESC);

-- Listing outings by date
CREATE INDEX IF NOT EXISTS idx_animal_outings_started
  ON animal_outings(started_at DESC);

-- Filter by walker
CREATE INDEX IF NOT EXISTS idx_animal_outings_walked_by
  ON animal_outings(walked_by);

-- ============================================================
-- 3. RLS policies (same chain as animal_health_records)
-- ============================================================
ALTER TABLE animal_outings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'animal_outings_select') THEN
    CREATE POLICY "animal_outings_select" ON animal_outings FOR SELECT USING (
      animal_id IN (
        SELECT id FROM animals WHERE establishment_id IN (
          SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
        )
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'animal_outings_insert') THEN
    CREATE POLICY "animal_outings_insert" ON animal_outings FOR INSERT WITH CHECK (
      animal_id IN (
        SELECT id FROM animals WHERE establishment_id IN (
          SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
        )
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'animal_outings_update') THEN
    CREATE POLICY "animal_outings_update" ON animal_outings FOR UPDATE USING (
      animal_id IN (
        SELECT id FROM animals WHERE establishment_id IN (
          SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
        )
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'animal_outings_delete') THEN
    CREATE POLICY "animal_outings_delete" ON animal_outings FOR DELETE USING (
      animal_id IN (
        SELECT id FROM animals WHERE establishment_id IN (
          SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
        )
      )
    );
  END IF;
END $$;

-- ============================================================
-- 4. New permission: manage_outings (default true for all)
-- ============================================================
ALTER TABLE establishment_members
  ADD COLUMN IF NOT EXISTS manage_outings BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- DONE! Animal outings schema ready.
-- ============================================================
