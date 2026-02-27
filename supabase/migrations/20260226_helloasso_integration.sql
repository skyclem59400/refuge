-- ============================================================
-- SDA Refuge — HelloAsso Integration
-- Migration: 20260226_helloasso_integration
-- A executer dans Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. HelloAsso Connections (credentials per establishment)
-- ============================================================
CREATE TABLE IF NOT EXISTS helloasso_connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id    UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,

  -- OAuth2 credentials
  client_id           TEXT NOT NULL,
  client_secret       TEXT NOT NULL,
  organization_slug   TEXT NOT NULL,

  -- Token management (stored encrypted ideally, but functional here)
  access_token        TEXT,
  refresh_token       TEXT,
  token_expires_at    TIMESTAMPTZ,

  -- Sync state
  last_sync_at        TIMESTAMPTZ,
  sync_status         TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
  sync_error          TEXT,

  -- Webhook
  webhook_secret      TEXT,

  -- Metadata
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(establishment_id)
);

CREATE INDEX IF NOT EXISTS idx_helloasso_connections_establishment ON helloasso_connections(establishment_id);

-- ============================================================
-- 2. Extend donations table
-- ============================================================

-- Source: manual (entered by staff) or helloasso (auto-synced)
ALTER TABLE donations ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'helloasso'));

-- HelloAsso reference IDs (for deduplication)
ALTER TABLE donations ADD COLUMN IF NOT EXISTS helloasso_payment_id BIGINT;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS helloasso_order_id BIGINT;

-- Add 'helloasso' to payment_method CHECK
-- Drop old constraint and recreate with 'helloasso' included
ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_payment_method_check;
ALTER TABLE donations ADD CONSTRAINT donations_payment_method_check
  CHECK (payment_method IN ('cheque', 'virement', 'especes', 'cb', 'prelevement', 'helloasso', 'autre'));

-- Index for deduplication lookups
CREATE INDEX IF NOT EXISTS idx_donations_helloasso_payment
  ON donations(helloasso_payment_id) WHERE helloasso_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_donations_source ON donations(source);

-- ============================================================
-- 3. Trigger updated_at for helloasso_connections
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_helloasso_connections_updated') THEN
    CREATE TRIGGER tr_helloasso_connections_updated
      BEFORE UPDATE ON helloasso_connections
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ============================================================
-- 4. RLS policies for helloasso_connections
-- ============================================================
ALTER TABLE helloasso_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'helloasso_connections_select') THEN
    CREATE POLICY "helloasso_connections_select" ON helloasso_connections FOR SELECT USING (
      establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'helloasso_connections_insert') THEN
    CREATE POLICY "helloasso_connections_insert" ON helloasso_connections FOR INSERT WITH CHECK (
      establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'helloasso_connections_update') THEN
    CREATE POLICY "helloasso_connections_update" ON helloasso_connections FOR UPDATE USING (
      establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'helloasso_connections_delete') THEN
    CREATE POLICY "helloasso_connections_delete" ON helloasso_connections FOR DELETE USING (
      establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
    );
  END IF;
END $$;

-- ============================================================
-- DONE! HelloAsso integration schema ready.
-- ============================================================
