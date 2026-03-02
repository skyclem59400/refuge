-- ============================================================
-- SDA Refuge — Outing Assignments System
-- Migration: 20260302_outing_assignments
-- Permet aux managers d'assigner des chiens a des personnes
-- A executer dans Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. New permission column on permission_groups
-- ============================================================
ALTER TABLE permission_groups
  ADD COLUMN IF NOT EXISTS manage_outing_assignments BOOLEAN NOT NULL DEFAULT false;

-- Update Administrateur system groups to have this permission
UPDATE permission_groups
SET manage_outing_assignments = true
WHERE is_system = true AND name = 'Administrateur';

-- ============================================================
-- 2. Update user_has_permission function to include new perm
-- ============================================================
CREATE OR REPLACE FUNCTION user_has_permission(est_id UUID, perm_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM establishment_members em
    JOIN member_groups mg ON mg.member_id = em.id
    JOIN permission_groups pg ON pg.id = mg.group_id
    WHERE em.user_id = auth.uid()
      AND em.establishment_id = est_id
      AND (
        CASE perm_name
          WHEN 'manage_documents'           THEN pg.manage_documents
          WHEN 'manage_clients'             THEN pg.manage_clients
          WHEN 'manage_establishment'       THEN pg.manage_establishment
          WHEN 'manage_animals'             THEN pg.manage_animals
          WHEN 'view_animals'               THEN pg.view_animals
          WHEN 'manage_health'              THEN pg.manage_health
          WHEN 'manage_movements'           THEN pg.manage_movements
          WHEN 'manage_boxes'               THEN pg.manage_boxes
          WHEN 'manage_posts'               THEN pg.manage_posts
          WHEN 'manage_donations'           THEN pg.manage_donations
          WHEN 'manage_outings'             THEN pg.manage_outings
          WHEN 'manage_outing_assignments'  THEN pg.manage_outing_assignments
          WHEN 'view_pound'                 THEN pg.view_pound
          WHEN 'view_statistics'            THEN pg.view_statistics
          ELSE false
        END
      )
  );
$$;

-- ============================================================
-- 3. Table: outing_assignments
-- ============================================================
CREATE TABLE IF NOT EXISTS outing_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  animal_id         UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  assigned_to       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  outing_id         UUID REFERENCES animal_outings(id) ON DELETE SET NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(animal_id, assigned_to, date)
);

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_outing_assignments_est_date
  ON outing_assignments(establishment_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_outing_assignments_assigned_to
  ON outing_assignments(assigned_to, date DESC);

CREATE INDEX IF NOT EXISTS idx_outing_assignments_animal
  ON outing_assignments(animal_id, date DESC);

-- ============================================================
-- 5. RLS policies
-- ============================================================
ALTER TABLE outing_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'outing_assignments_select') THEN
    CREATE POLICY "outing_assignments_select" ON outing_assignments FOR SELECT USING (
      establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'outing_assignments_insert') THEN
    CREATE POLICY "outing_assignments_insert" ON outing_assignments FOR INSERT WITH CHECK (
      user_has_permission(establishment_id, 'manage_outing_assignments')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'outing_assignments_update') THEN
    CREATE POLICY "outing_assignments_update" ON outing_assignments FOR UPDATE USING (
      user_has_permission(establishment_id, 'manage_outing_assignments')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'outing_assignments_delete') THEN
    CREATE POLICY "outing_assignments_delete" ON outing_assignments FOR DELETE USING (
      user_has_permission(establishment_id, 'manage_outing_assignments')
    );
  END IF;
END $$;

-- ============================================================
-- DONE! Outing assignments schema ready.
-- ============================================================
