-- ============================================================
-- SDA Refuge — Pound Interventions Tracking
-- Migration: 20260228_pound_interventions
-- Tracabilite des interventions de fourriere
-- A executer dans Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. Table: pound_interventions
-- ============================================================
CREATE TABLE IF NOT EXISTS pound_interventions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id       UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  animal_id              UUID REFERENCES animals(id) ON DELETE SET NULL,

  -- Appelant
  caller_name            TEXT NOT NULL,
  caller_phone           TEXT,
  caller_email           TEXT,

  -- Lieu d'intervention
  location_street_number TEXT,
  location_street        TEXT NOT NULL,
  location_city          TEXT NOT NULL,

  -- Intervention
  intervention_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
  intervened_by          UUID NOT NULL REFERENCES auth.users(id),
  notes                  TEXT,

  created_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pound_interventions_establishment
  ON pound_interventions(establishment_id);

CREATE INDEX IF NOT EXISTS idx_pound_interventions_date
  ON pound_interventions(intervention_date DESC);

CREATE INDEX IF NOT EXISTS idx_pound_interventions_animal
  ON pound_interventions(animal_id);

-- ============================================================
-- 3. Trigger updated_at
-- ============================================================
CREATE TRIGGER tr_pound_interventions_updated
  BEFORE UPDATE ON pound_interventions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. RLS policies
-- ============================================================
ALTER TABLE pound_interventions ENABLE ROW LEVEL SECURITY;

-- SELECT: all establishment members can read
CREATE POLICY "pound_interventions_select" ON pound_interventions
  FOR SELECT USING (
    establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  );

-- INSERT: requires manage_movements permission
CREATE POLICY "pound_interventions_insert" ON pound_interventions
  FOR INSERT WITH CHECK (
    user_has_permission(establishment_id, 'manage_movements')
  );

-- UPDATE: requires manage_movements permission
CREATE POLICY "pound_interventions_update" ON pound_interventions
  FOR UPDATE USING (
    user_has_permission(establishment_id, 'manage_movements')
  );

-- DELETE: requires manage_movements permission
CREATE POLICY "pound_interventions_delete" ON pound_interventions
  FOR DELETE USING (
    user_has_permission(establishment_id, 'manage_movements')
  );

-- ============================================================
-- DONE! Pound interventions tracking ready.
-- ============================================================
