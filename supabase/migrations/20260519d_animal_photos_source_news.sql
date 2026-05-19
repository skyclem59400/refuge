-- Lien entre animal_photos et animal_news : permet de retrouver les photos
-- des nouvelles dans le tab Photos standard de la fiche animal, même après
-- adoption. Le CASCADE garantit qu'on nettoie automatiquement quand une
-- nouvelle est supprimée.

ALTER TABLE animal_photos
  ADD COLUMN IF NOT EXISTS source_news_id UUID REFERENCES animal_news(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_animal_photos_source_news
  ON animal_photos(source_news_id)
  WHERE source_news_id IS NOT NULL;
