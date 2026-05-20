-- ============================================================
-- Lieu de récupération structuré (autocomplétion BAN)
-- ============================================================
-- L'animal peut être récupéré n'importe où (saisie judiciaire, divagation,
-- abandon sur la voie publique, transfert). On structure l'adresse pour
-- éviter les variantes d'écriture (autocomplétion via l'API BAN).
-- capture_location (existant) garde le label complet pour rétrocompat.
-- ============================================================

ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS pickup_address_label TEXT,
  ADD COLUMN IF NOT EXISTS pickup_postcode TEXT,
  ADD COLUMN IF NOT EXISTS pickup_city TEXT,
  ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS pickup_ban_id TEXT;

COMMENT ON COLUMN animals.pickup_address_label
  IS 'Label complet de l adresse de recuperation, choisi via autocompletion BAN. Source de verite pour l affichage.';
COMMENT ON COLUMN animals.pickup_postcode
  IS 'Code postal extrait de l adresse BAN.';
COMMENT ON COLUMN animals.pickup_city
  IS 'Ville extraite de l adresse BAN (pour stats / filtres).';
COMMENT ON COLUMN animals.pickup_ban_id
  IS 'ID stable de l adresse dans la Base Adresse Nationale.';

-- Backfill : si capture_location avait deja une valeur, on la met dans pickup_address_label
-- comme premiere approximation. L'utilisateur pourra re-saisir via autocomplete au prochain edit.
UPDATE animals
SET pickup_address_label = capture_location
WHERE capture_location IS NOT NULL
  AND pickup_address_label IS NULL;

CREATE INDEX IF NOT EXISTS idx_animals_pickup_city ON animals(pickup_city) WHERE pickup_city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_animals_pickup_postcode ON animals(pickup_postcode) WHERE pickup_postcode IS NOT NULL;
