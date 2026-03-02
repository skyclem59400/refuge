-- ============================================================
-- SDA Refuge — Activity Logs (Audit Trail)
-- Migration: 20260302_activity_logs
-- Trace toutes les actions des utilisateurs
-- Visible uniquement par les administrateurs
-- A executer dans Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. Table: activity_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action            TEXT NOT NULL,
  entity_type       TEXT NOT NULL,
  entity_id         UUID,
  entity_name       TEXT,
  parent_type       TEXT,
  parent_id         UUID,
  details           JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_activity_logs_est_date
  ON activity_logs(establishment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity
  ON activity_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user
  ON activity_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_parent
  ON activity_logs(parent_type, parent_id, created_at DESC);

-- ============================================================
-- 3. RLS policies — admin read only, server insert
-- ============================================================
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- SELECT: only admins (members of Administrateur group)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'activity_logs_select') THEN
    CREATE POLICY "activity_logs_select" ON activity_logs FOR SELECT USING (
      EXISTS (
        SELECT 1
        FROM establishment_members em
        JOIN member_groups mg ON mg.member_id = em.id
        JOIN permission_groups pg ON pg.id = mg.group_id
        WHERE em.user_id = auth.uid()
          AND em.establishment_id = activity_logs.establishment_id
          AND pg.is_system = true
          AND pg.name = 'Administrateur'
      )
    );
  END IF;

  -- INSERT: all members (logged by server actions)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'activity_logs_insert') THEN
    CREATE POLICY "activity_logs_insert" ON activity_logs FOR INSERT WITH CHECK (
      establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    );
  END IF;

  -- No UPDATE or DELETE — logs are immutable
END $$;

-- ============================================================
-- DONE! Activity logs schema ready.
-- ============================================================
