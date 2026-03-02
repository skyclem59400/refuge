-- ============================================================
-- SDA Refuge — Champ "adoptable" sur les animaux
-- Migration: 20260302_adoptable_field
-- Permet de marquer un animal comme etant a l'adoption
-- A executer dans Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. Colonne adoptable sur la table animals
-- ============================================================
ALTER TABLE animals ADD COLUMN IF NOT EXISTS adoptable BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 2. Permission manage_adoptions sur permission_groups
-- ============================================================
ALTER TABLE permission_groups
  ADD COLUMN IF NOT EXISTS manage_adoptions BOOLEAN NOT NULL DEFAULT false;

-- Activer pour le groupe Administrateur existant
UPDATE permission_groups
SET manage_adoptions = true
WHERE is_system = true AND name = 'Administrateur';

-- ============================================================
-- 3. Mettre a jour user_has_permission() avec le nouveau CASE
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
          WHEN 'manage_adoptions'           THEN pg.manage_adoptions
          WHEN 'view_pound'                 THEN pg.view_pound
          WHEN 'view_statistics'            THEN pg.view_statistics
          ELSE false
        END
      )
  );
$$;

-- ============================================================
-- DONE! Adoptable field and permission ready.
-- ============================================================
