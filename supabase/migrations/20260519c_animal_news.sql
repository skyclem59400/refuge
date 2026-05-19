-- =====================================================================
-- Migration 2026-05-19c — Nouvelles d'animaux (post-adoption / FA)
-- - Table `animal_news` : photos + messages reçus des familles
-- - Table `animal_news_mosaics` : mosaïques de publication
-- - Permission `view_animal_news` (privée, désactivée par défaut)
-- - Préfixe storage `news/` dans le bucket `animal-photos` existant
-- =====================================================================

-- =========================================
-- 1) Permission view_animal_news
-- =========================================

ALTER TABLE permission_groups
  ADD COLUMN IF NOT EXISTS view_animal_news BOOLEAN NOT NULL DEFAULT false;

-- Active la permission par défaut UNIQUEMENT sur les groupes Administrateur (système)
UPDATE permission_groups
SET view_animal_news = true
WHERE is_system = true AND name = 'Administrateur';

-- =========================================
-- 2) Table animal_news
-- =========================================

CREATE TABLE IF NOT EXISTS animal_news (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id     UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  animal_id            UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  -- 1..N photos uploadées dans Supabase Storage (préfixe news/)
  -- Format : [{ url: string, path: string }]
  photos               JSONB NOT NULL DEFAULT '[]'::jsonb,
  text                 TEXT,
  received_from        TEXT, -- "famille adoptante", "FA Mme Dupont", etc.
  received_at          DATE NOT NULL DEFAULT CURRENT_DATE,
  -- NULL tant que pas publié, sinon la date de publication
  posted_at            TIMESTAMPTZ,
  -- Si publié en mosaïque avec d'autres, l'id de la mosaïque
  posted_in_mosaic_id  UUID,
  created_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_animal_news_animal ON animal_news(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_news_estab_pending
  ON animal_news(establishment_id) WHERE posted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animal_news_estab_posted
  ON animal_news(establishment_id, posted_at DESC) WHERE posted_at IS NOT NULL;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION animal_news_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_animal_news_updated ON animal_news;
CREATE TRIGGER tr_animal_news_updated
  BEFORE UPDATE ON animal_news
  FOR EACH ROW
  EXECUTE FUNCTION animal_news_set_updated_at();

-- =========================================
-- 3) Table animal_news_mosaics
-- =========================================

CREATE TABLE IF NOT EXISTS animal_news_mosaics (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id      UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  -- IDs des animal_news utilisés
  news_ids              UUID[] NOT NULL,
  title                 TEXT,
  generated_image_url   TEXT,
  posted_at             TIMESTAMPTZ,
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_animal_news_mosaics_estab
  ON animal_news_mosaics(establishment_id, posted_at DESC);

-- FK from animal_news.posted_in_mosaic_id (ajoutée après création des deux tables)
ALTER TABLE animal_news
  DROP CONSTRAINT IF EXISTS animal_news_posted_in_mosaic_id_fkey;
ALTER TABLE animal_news
  ADD CONSTRAINT animal_news_posted_in_mosaic_id_fkey
  FOREIGN KEY (posted_in_mosaic_id) REFERENCES animal_news_mosaics(id) ON DELETE SET NULL;

-- =========================================
-- 4) RLS — multi-établissement standard
-- =========================================

ALTER TABLE animal_news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS animal_news_select ON animal_news;
CREATE POLICY animal_news_select ON animal_news FOR SELECT
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS animal_news_insert ON animal_news;
CREATE POLICY animal_news_insert ON animal_news FOR INSERT
  WITH CHECK (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS animal_news_update ON animal_news;
CREATE POLICY animal_news_update ON animal_news FOR UPDATE
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS animal_news_delete ON animal_news;
CREATE POLICY animal_news_delete ON animal_news FOR DELETE
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

ALTER TABLE animal_news_mosaics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS animal_news_mosaics_select ON animal_news_mosaics;
CREATE POLICY animal_news_mosaics_select ON animal_news_mosaics FOR SELECT
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS animal_news_mosaics_insert ON animal_news_mosaics;
CREATE POLICY animal_news_mosaics_insert ON animal_news_mosaics FOR INSERT
  WITH CHECK (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS animal_news_mosaics_update ON animal_news_mosaics;
CREATE POLICY animal_news_mosaics_update ON animal_news_mosaics FOR UPDATE
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS animal_news_mosaics_delete ON animal_news_mosaics;
CREATE POLICY animal_news_mosaics_delete ON animal_news_mosaics FOR DELETE
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));
