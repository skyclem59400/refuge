-- Étend la liste des sources autorisées pour donations afin d'accepter
-- les adhésions automatiquement créées au moment d'une adoption.
ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_source_check;
ALTER TABLE donations ADD CONSTRAINT donations_source_check
  CHECK (source IS NULL OR source = ANY (ARRAY['manual','helloasso','adoption']));
