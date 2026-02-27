-- ============================================================
-- SDA Refuge — Social Posts v2: Scheduling + Meta API
-- À exécuter dans Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. Etendre la table social_posts
-- ============================================================
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS establishment_id UUID REFERENCES establishments(id);
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS content_facebook TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS content_instagram TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS meta_fb_post_id TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS meta_ig_media_id TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS publish_error TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Rendre animal_id optionnel (posts standalone)
ALTER TABLE social_posts ALTER COLUMN animal_id DROP NOT NULL;

-- ============================================================
-- 2. Etendre les contraintes type et status
-- ============================================================
ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_type_check;
ALTER TABLE social_posts ADD CONSTRAINT social_posts_type_check
  CHECK (type IN ('search_owner', 'adoption', 'event', 'info', 'other'));

ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_status_check;
ALTER TABLE social_posts ADD CONSTRAINT social_posts_status_check
  CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed', 'archived'));

-- ============================================================
-- 3. Backfill establishment_id depuis animal
-- ============================================================
UPDATE social_posts sp
SET establishment_id = a.establishment_id
FROM animals a
WHERE sp.animal_id = a.id
  AND sp.establishment_id IS NULL;

-- ============================================================
-- 4. Index pour le worker Trigger.dev
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled
  ON social_posts(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_social_posts_establishment
  ON social_posts(establishment_id);

-- ============================================================
-- 5. Table meta_connections
-- ============================================================
CREATE TABLE IF NOT EXISTS meta_connections (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id              UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  facebook_page_id              TEXT NOT NULL,
  facebook_page_name            TEXT NOT NULL,
  facebook_page_access_token    TEXT NOT NULL,
  instagram_business_account_id TEXT,
  token_expires_at              TIMESTAMPTZ,
  connected_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(establishment_id)
);

-- ============================================================
-- 6. Trigger updated_at meta_connections
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_meta_connections_updated') THEN
    CREATE TRIGGER tr_meta_connections_updated
      BEFORE UPDATE ON meta_connections
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ============================================================
-- 7. RLS meta_connections
-- ============================================================
ALTER TABLE meta_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'meta_connections_select') THEN
    CREATE POLICY "meta_connections_select" ON meta_connections FOR SELECT USING (
      establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'meta_connections_insert') THEN
    CREATE POLICY "meta_connections_insert" ON meta_connections FOR INSERT WITH CHECK (
      establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'meta_connections_update') THEN
    CREATE POLICY "meta_connections_update" ON meta_connections FOR UPDATE USING (
      establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'meta_connections_delete') THEN
    CREATE POLICY "meta_connections_delete" ON meta_connections FOR DELETE USING (
      establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- ============================================================
-- 8. Mettre a jour les RLS de social_posts pour establishment_id
-- ============================================================
-- Drop les anciennes policies basees sur animal join
DROP POLICY IF EXISTS "social_posts_select" ON social_posts;
DROP POLICY IF EXISTS "social_posts_insert" ON social_posts;
DROP POLICY IF EXISTS "social_posts_update" ON social_posts;
DROP POLICY IF EXISTS "social_posts_delete" ON social_posts;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_posts_select_v2') THEN
    CREATE POLICY "social_posts_select_v2" ON social_posts FOR SELECT USING (
      establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_posts_insert_v2') THEN
    CREATE POLICY "social_posts_insert_v2" ON social_posts FOR INSERT WITH CHECK (
      establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_posts_update_v2') THEN
    CREATE POLICY "social_posts_update_v2" ON social_posts FOR UPDATE USING (
      establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_posts_delete_v2') THEN
    CREATE POLICY "social_posts_delete_v2" ON social_posts FOR DELETE USING (
      establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- ============================================================
-- DONE ! Social Posts v2 + Meta Connections en place.
-- N'oubliez pas de creer le bucket 'social-media' (public) dans Supabase Storage.
-- ============================================================
