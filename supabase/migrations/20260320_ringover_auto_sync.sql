-- ============================================================
-- SDA Refuge — Ringover Auto-Sync Configuration
-- Migration: 20260320_ringover_auto_sync
-- Ajoute les colonnes de config auto-sync (Trigger.dev)
-- A executer dans Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE ringover_connections
  ADD COLUMN IF NOT EXISTS auto_sync_enabled  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_sync_cron     TEXT NOT NULL DEFAULT '0 6 * * *',
  ADD COLUMN IF NOT EXISTS auto_sync_schedule_id TEXT;

COMMENT ON COLUMN ringover_connections.auto_sync_enabled IS 'Active la synchronisation automatique via Trigger.dev';
COMMENT ON COLUMN ringover_connections.auto_sync_cron IS 'Expression cron pour la sync auto (defaut: 6h du matin UTC)';
COMMENT ON COLUMN ringover_connections.auto_sync_schedule_id IS 'ID du schedule Trigger.dev pour pouvoir le modifier/supprimer';
