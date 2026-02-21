-- Social posts for AI-generated publications
CREATE TABLE IF NOT EXISTS social_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id     UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('search_owner', 'adoption')),
  platform      TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'both')),
  content       TEXT NOT NULL,
  photo_urls    TEXT[] DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at  TIMESTAMPTZ,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_animal ON social_posts(animal_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_posts_select" ON social_posts;
DROP POLICY IF EXISTS "social_posts_insert" ON social_posts;
DROP POLICY IF EXISTS "social_posts_update" ON social_posts;
DROP POLICY IF EXISTS "social_posts_delete" ON social_posts;

CREATE POLICY "social_posts_select" ON social_posts FOR SELECT USING (
  animal_id IN (SELECT id FROM animals WHERE establishment_id IN (
    SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "social_posts_insert" ON social_posts FOR INSERT WITH CHECK (
  animal_id IN (SELECT id FROM animals WHERE establishment_id IN (
    SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "social_posts_update" ON social_posts FOR UPDATE USING (
  animal_id IN (SELECT id FROM animals WHERE establishment_id IN (
    SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "social_posts_delete" ON social_posts FOR DELETE USING (
  animal_id IN (SELECT id FROM animals WHERE establishment_id IN (
    SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
  ))
);
