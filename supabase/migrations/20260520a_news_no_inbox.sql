-- ============================================================
-- Suppression du workflow "inbox" pour animal_news
-- ============================================================
-- Refonte 2026-05-20 : on supprime la logique inbox / publication différée.
-- Une news est désormais publiée immédiatement à sa création.
--
-- Effets :
--   1. Toutes les news avec posted_at IS NULL (anciennement en inbox)
--      sont rétroactivement marquées comme publiées à leur date de création.
--   2. Une contrainte garantit que posted_at est toujours renseigné pour les
--      nouvelles entrées (NOT NULL avec valeur par défaut = now()).
--
-- La colonne posted_at est conservée car elle est utile pour distinguer la
-- date de publication de la date de réception (received_at) qui correspond
-- à la date que l'adoptant a indiquée pour sa photo.
-- ============================================================

-- 1. Backfill : passer en publié toutes les news inbox existantes
UPDATE animal_news
SET posted_at = COALESCE(posted_at, created_at, now())
WHERE posted_at IS NULL;

-- 2. Forcer NOT NULL + default now() pour toutes les futures insertions
ALTER TABLE animal_news
  ALTER COLUMN posted_at SET DEFAULT now();

ALTER TABLE animal_news
  ALTER COLUMN posted_at SET NOT NULL;

-- 3. Index pour les requêtes par catégorie / date
CREATE INDEX IF NOT EXISTS idx_animal_news_posted_at
  ON animal_news(establishment_id, posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_animal_news_animal
  ON animal_news(animal_id, received_at DESC);
