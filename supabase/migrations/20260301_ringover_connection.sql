-- ============================================================
-- SDA Refuge — Ringover Connection for Pound Interventions
-- Migration: 20260301_ringover_connection
-- Stocke la config Ringover (cle API + ligne d'astreinte)
-- A executer dans Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. Table: ringover_connections
-- ============================================================
CREATE TABLE IF NOT EXISTS ringover_connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id    UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  api_key             TEXT NOT NULL,
  astreinte_number    TEXT,
  astreinte_label     TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(establishment_id)
);

-- ============================================================
-- 2. Index
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ringover_connections_establishment
  ON ringover_connections(establishment_id);

-- ============================================================
-- 3. Trigger updated_at
-- ============================================================
CREATE TRIGGER tr_ringover_connections_updated
  BEFORE UPDATE ON ringover_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. RLS policies
-- ============================================================
ALTER TABLE ringover_connections ENABLE ROW LEVEL SECURITY;

-- SELECT: requires manage_establishment permission
CREATE POLICY "ringover_connections_select" ON ringover_connections
  FOR SELECT USING (
    user_has_permission(establishment_id, 'manage_establishment')
  );

-- INSERT: requires manage_establishment permission
CREATE POLICY "ringover_connections_insert" ON ringover_connections
  FOR INSERT WITH CHECK (
    user_has_permission(establishment_id, 'manage_establishment')
  );

-- UPDATE: requires manage_establishment permission
CREATE POLICY "ringover_connections_update" ON ringover_connections
  FOR UPDATE USING (
    user_has_permission(establishment_id, 'manage_establishment')
  );

-- DELETE: requires manage_establishment permission
CREATE POLICY "ringover_connections_delete" ON ringover_connections
  FOR DELETE USING (
    user_has_permission(establishment_id, 'manage_establishment')
  );

-- ============================================================
-- DONE! Ringover connection table ready.
-- ============================================================
