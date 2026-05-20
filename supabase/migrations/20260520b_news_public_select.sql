-- ============================================================
-- Lecture publique des news des animaux encore au refuge
-- ============================================================
-- La plateforme parrainage publique (parrainage.sda-nord.com) doit pouvoir
-- afficher anonymement les news des animaux longs séjours (statuts
-- shelter/pound/boarding/foster_family). Les news des animaux sortis
-- (adopted/transferred/returned) restent privées au refuge — elles seront
-- exposées différemment via la page Nouvelles du site sda-website.
--
-- Cette policy s'ajoute à la policy existante `animal_news_select` qui
-- autorise les membres de l'établissement à tout voir.
-- ============================================================

DROP POLICY IF EXISTS "animal_news_public_select_sheltered" ON animal_news;

CREATE POLICY "animal_news_public_select_sheltered" ON animal_news
  FOR SELECT
  USING (
    posted_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM animals
      WHERE animals.id = animal_news.animal_id
        AND animals.status IN ('shelter', 'pound', 'boarding', 'foster_family')
    )
  );

-- ============================================================
-- Lecture publique des animaux long séjour
-- ============================================================
-- Permet à la plateforme parrainage d'afficher les fiches animaux + photo
-- principale + race + age. Pas les détails sensibles (juridique, contacts).

DROP POLICY IF EXISTS "animals_public_select_sheltered" ON animals;

CREATE POLICY "animals_public_select_sheltered" ON animals
  FOR SELECT
  USING (
    status IN ('shelter', 'pound', 'boarding', 'foster_family')
  );
