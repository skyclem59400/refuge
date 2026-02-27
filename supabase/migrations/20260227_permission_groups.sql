-- ============================================================
-- SDA Refuge — Permission Groups System
-- Migration: 20260227_permission_groups
-- Remplace les permissions individuelles par un systeme de groupes
-- A executer dans Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. Table: permission_groups
-- ============================================================
CREATE TABLE IF NOT EXISTS permission_groups (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id      UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  description           TEXT DEFAULT '',
  is_system             BOOLEAN NOT NULL DEFAULT false,
  -- 13 permission booleans
  manage_documents      BOOLEAN NOT NULL DEFAULT false,
  manage_clients        BOOLEAN NOT NULL DEFAULT false,
  manage_establishment  BOOLEAN NOT NULL DEFAULT false,
  manage_animals        BOOLEAN NOT NULL DEFAULT false,
  view_animals          BOOLEAN NOT NULL DEFAULT false,
  manage_health         BOOLEAN NOT NULL DEFAULT false,
  manage_movements      BOOLEAN NOT NULL DEFAULT false,
  manage_boxes          BOOLEAN NOT NULL DEFAULT false,
  manage_posts          BOOLEAN NOT NULL DEFAULT false,
  manage_donations      BOOLEAN NOT NULL DEFAULT false,
  manage_outings        BOOLEAN NOT NULL DEFAULT false,
  view_pound            BOOLEAN NOT NULL DEFAULT false,
  view_statistics       BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, name)
);

-- ============================================================
-- 2. Table: member_groups (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS member_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES establishment_members(id) ON DELETE CASCADE,
  group_id    UUID NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, group_id)
);

-- ============================================================
-- 3. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pgroups_establishment
  ON permission_groups(establishment_id);

CREATE INDEX IF NOT EXISTS idx_mgroups_member
  ON member_groups(member_id);

CREATE INDEX IF NOT EXISTS idx_mgroups_group
  ON member_groups(group_id);

-- ============================================================
-- 4. Triggers updated_at
-- ============================================================
CREATE TRIGGER tr_permission_groups_updated
  BEFORE UPDATE ON permission_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 5. Helper function for RLS: user_has_permission
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
          WHEN 'manage_documents'     THEN pg.manage_documents
          WHEN 'manage_clients'       THEN pg.manage_clients
          WHEN 'manage_establishment' THEN pg.manage_establishment
          WHEN 'manage_animals'       THEN pg.manage_animals
          WHEN 'view_animals'         THEN pg.view_animals
          WHEN 'manage_health'        THEN pg.manage_health
          WHEN 'manage_movements'     THEN pg.manage_movements
          WHEN 'manage_boxes'         THEN pg.manage_boxes
          WHEN 'manage_posts'         THEN pg.manage_posts
          WHEN 'manage_donations'     THEN pg.manage_donations
          WHEN 'manage_outings'       THEN pg.manage_outings
          WHEN 'view_pound'           THEN pg.view_pound
          WHEN 'view_statistics'      THEN pg.view_statistics
          ELSE false
        END
      )
  );
$$;

-- ============================================================
-- 6. Data migration: create default groups + assign members
-- ============================================================
DO $$
DECLARE
  est RECORD;
  admin_group_id UUID;
  member_group_id UUID;
BEGIN
  FOR est IN SELECT id FROM establishments LOOP
    -- Create "Administrateur" system group (all permissions true)
    INSERT INTO permission_groups (
      establishment_id, name, description, is_system,
      manage_documents, manage_clients, manage_establishment,
      manage_animals, view_animals, manage_health, manage_movements,
      manage_boxes, manage_posts, manage_donations, manage_outings,
      view_pound, view_statistics
    ) VALUES (
      est.id, 'Administrateur', 'Acces complet a toutes les fonctionnalites', true,
      true, true, true, true, true, true, true, true, true, true, true, true, true
    ) RETURNING id INTO admin_group_id;

    -- Create "Membre" default group (view only)
    INSERT INTO permission_groups (
      establishment_id, name, description, is_system,
      manage_documents, manage_clients, manage_establishment,
      manage_animals, view_animals, manage_health, manage_movements,
      manage_boxes, manage_posts, manage_donations, manage_outings,
      view_pound, view_statistics
    ) VALUES (
      est.id, 'Membre', 'Acces en lecture seule', false,
      false, false, false, false, true, false, false, false, false, false, false, true, true
    ) RETURNING id INTO member_group_id;

    -- Assign admin members to Administrateur group
    INSERT INTO member_groups (member_id, group_id)
    SELECT id, admin_group_id
    FROM establishment_members
    WHERE establishment_id = est.id AND role = 'admin';

    -- Assign non-admin members to Membre group
    INSERT INTO member_groups (member_id, group_id)
    SELECT id, member_group_id
    FROM establishment_members
    WHERE establishment_id = est.id AND role = 'member';
  END LOOP;
END $$;

-- ============================================================
-- 7. Drop old RLS policies that reference 'role' column
--    (new policies are created in sections 9-12 below)
-- ============================================================
DROP POLICY IF EXISTS "estab_update" ON establishments;
DROP POLICY IF EXISTS "members_insert" ON establishment_members;
DROP POLICY IF EXISTS "members_update" ON establishment_members;
DROP POLICY IF EXISTS "members_delete" ON establishment_members;
DROP POLICY IF EXISTS "docs_estab_insert" ON documents;
DROP POLICY IF EXISTS "docs_estab_update" ON documents;
DROP POLICY IF EXISTS "docs_estab_delete" ON documents;
DROP POLICY IF EXISTS "clients_estab_insert" ON clients;
DROP POLICY IF EXISTS "clients_estab_update" ON clients;
DROP POLICY IF EXISTS "clients_estab_delete" ON clients;

-- ============================================================
-- 8. Drop old columns from establishment_members
-- ============================================================
ALTER TABLE establishment_members
  DROP COLUMN IF EXISTS role,
  DROP COLUMN IF EXISTS manage_documents,
  DROP COLUMN IF EXISTS manage_clients,
  DROP COLUMN IF EXISTS manage_establishment,
  DROP COLUMN IF EXISTS manage_animals,
  DROP COLUMN IF EXISTS view_animals,
  DROP COLUMN IF EXISTS manage_health,
  DROP COLUMN IF EXISTS manage_movements,
  DROP COLUMN IF EXISTS manage_boxes,
  DROP COLUMN IF EXISTS manage_posts,
  DROP COLUMN IF EXISTS manage_donations,
  DROP COLUMN IF EXISTS manage_outings,
  DROP COLUMN IF EXISTS view_pound,
  DROP COLUMN IF EXISTS view_statistics;

-- ============================================================
-- 9. RLS for new tables
-- ============================================================
ALTER TABLE permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_groups ENABLE ROW LEVEL SECURITY;

-- permission_groups: all establishment members can read
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pgroups_select') THEN
    CREATE POLICY "pgroups_select" ON permission_groups FOR SELECT
      USING (establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pgroups_insert') THEN
    CREATE POLICY "pgroups_insert" ON permission_groups FOR INSERT
      WITH CHECK (user_has_permission(establishment_id, 'manage_establishment'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pgroups_update') THEN
    CREATE POLICY "pgroups_update" ON permission_groups FOR UPDATE
      USING (user_has_permission(establishment_id, 'manage_establishment'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pgroups_delete') THEN
    CREATE POLICY "pgroups_delete" ON permission_groups FOR DELETE
      USING (user_has_permission(establishment_id, 'manage_establishment') AND NOT is_system);
  END IF;
END $$;

-- member_groups: readable by establishment co-members
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mgroups_select') THEN
    CREATE POLICY "mgroups_select" ON member_groups FOR SELECT
      USING (member_id IN (
        SELECT id FROM establishment_members WHERE establishment_id IN (
          SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
        )
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mgroups_insert') THEN
    CREATE POLICY "mgroups_insert" ON member_groups FOR INSERT
      WITH CHECK (member_id IN (
        SELECT em.id FROM establishment_members em
        WHERE user_has_permission(em.establishment_id, 'manage_establishment')
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mgroups_delete') THEN
    CREATE POLICY "mgroups_delete" ON member_groups FOR DELETE
      USING (member_id IN (
        SELECT em.id FROM establishment_members em
        WHERE user_has_permission(em.establishment_id, 'manage_establishment')
      ));
  END IF;
END $$;

-- ============================================================
-- 10. Recreate RLS policies (establishments)
-- ============================================================
CREATE POLICY "estab_update" ON establishments FOR UPDATE
  USING (user_has_permission(id, 'manage_establishment'));

-- ============================================================
-- 11. Recreate RLS policies (establishment_members)
-- ============================================================
CREATE POLICY "members_insert" ON establishment_members FOR INSERT
  WITH CHECK (establishment_id IN (
    SELECT est_id FROM (SELECT establishment_id AS est_id FROM establishment_members WHERE user_id = auth.uid()) sub
    WHERE user_has_permission(est_id, 'manage_establishment')
  ));

CREATE POLICY "members_update" ON establishment_members FOR UPDATE
  USING (establishment_id IN (
    SELECT est_id FROM (SELECT establishment_id AS est_id FROM establishment_members WHERE user_id = auth.uid()) sub
    WHERE user_has_permission(est_id, 'manage_establishment')
  ));

CREATE POLICY "members_delete" ON establishment_members FOR DELETE
  USING (
    establishment_id IN (
      SELECT est_id FROM (SELECT establishment_id AS est_id FROM establishment_members WHERE user_id = auth.uid()) sub
      WHERE user_has_permission(est_id, 'manage_establishment')
    )
    AND user_id != auth.uid()
  );

-- ============================================================
-- 12. Recreate RLS policies (documents)
-- ============================================================
CREATE POLICY "docs_estab_insert" ON documents FOR INSERT
  WITH CHECK (user_has_permission(establishment_id, 'manage_documents'));

CREATE POLICY "docs_estab_update" ON documents FOR UPDATE
  USING (user_has_permission(establishment_id, 'manage_documents'));

CREATE POLICY "docs_estab_delete" ON documents FOR DELETE
  USING (user_has_permission(establishment_id, 'manage_documents'));

-- ============================================================
-- 13. Recreate RLS policies (clients)
-- ============================================================
CREATE POLICY "clients_estab_insert" ON clients FOR INSERT
  WITH CHECK (user_has_permission(establishment_id, 'manage_clients'));

CREATE POLICY "clients_estab_update" ON clients FOR UPDATE
  USING (user_has_permission(establishment_id, 'manage_clients'));

CREATE POLICY "clients_estab_delete" ON clients FOR DELETE
  USING (user_has_permission(establishment_id, 'manage_clients'));

-- ============================================================
-- DONE! Permission groups system ready.
-- ============================================================
