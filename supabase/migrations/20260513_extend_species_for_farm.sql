-- 20260513_extend_species_for_farm.sql
--
-- Étend l'enum CHECK constraint `animals.species` (et tables liées) pour supporter
-- les animaux de ferme et NAC en plus de chien/chat.
-- Ajoute également 3 nouvelles colonnes d'identification :
--   - sire_number  : n° SIRE pour équidés (cheval, âne, poney)
--   - ede_number   : n° EDE pour bovins/ovins/caprins/porcins (chèvre, mouton, cochon, vache)
--   - ring_number  : n° de bague pour oiseaux (perruche, perroquet, canari…)

-- ============================================================
-- 1) animals.species — étendre la liste autorisée
-- ============================================================

ALTER TABLE animals
  DROP CONSTRAINT IF EXISTS animals_species_check;

ALTER TABLE animals
  ADD CONSTRAINT animals_species_check CHECK (species IN (
    'dog', 'cat',
    'rabbit', 'guinea_pig', 'hamster', 'rat', 'ferret', 'chinchilla',
    'goat', 'sheep', 'pig', 'cow',
    'horse', 'donkey', 'pony',
    'chicken', 'duck', 'goose',
    'parakeet', 'parrot', 'canary',
    'tortoise',
    'other'
  ));

-- ============================================================
-- 2) Nouvelles colonnes d'identification
-- ============================================================

ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS sire_number TEXT,
  ADD COLUMN IF NOT EXISTS ede_number  TEXT,
  ADD COLUMN IF NOT EXISTS ring_number TEXT;

COMMENT ON COLUMN animals.sire_number IS 'N° SIRE — identification équidés (cheval, âne, poney)';
COMMENT ON COLUMN animals.ede_number  IS 'N° EDE — identification bovins/ovins/caprins/porcins';
COMMENT ON COLUMN animals.ring_number IS 'N° de bague — identification oiseaux';

-- ============================================================
-- 3) boxes.species_type — étendre la liste
-- ============================================================

ALTER TABLE boxes
  DROP CONSTRAINT IF EXISTS boxes_species_type_check;

ALTER TABLE boxes
  ADD CONSTRAINT boxes_species_type_check CHECK (species_type IN (
    'dog', 'cat', 'mixed',
    'rabbit', 'guinea_pig', 'hamster', 'rat', 'ferret', 'chinchilla',
    'goat', 'sheep', 'pig', 'cow',
    'horse', 'donkey', 'pony',
    'chicken', 'duck', 'goose',
    'parakeet', 'parrot', 'canary',
    'tortoise',
    'farm', 'other'
  ));

-- ============================================================
-- 4) health_protocols.applicable_species — étendre la liste
-- ============================================================

ALTER TABLE health_protocols
  DROP CONSTRAINT IF EXISTS health_protocols_applicable_species_check;

ALTER TABLE health_protocols
  ADD CONSTRAINT health_protocols_applicable_species_check CHECK (applicable_species IN (
    'dog', 'cat', 'both',
    'rabbit', 'guinea_pig', 'hamster', 'rat', 'ferret', 'chinchilla',
    'goat', 'sheep', 'pig', 'cow',
    'horse', 'donkey', 'pony',
    'chicken', 'duck', 'goose',
    'parakeet', 'parrot', 'canary',
    'tortoise',
    'all', 'other'
  ));

-- ============================================================
-- 5) astreinte_tickets.animal_species — étendre la liste
-- ============================================================

ALTER TABLE astreinte_tickets
  DROP CONSTRAINT IF EXISTS astreinte_tickets_animal_species_check;

ALTER TABLE astreinte_tickets
  ADD CONSTRAINT astreinte_tickets_animal_species_check CHECK (animal_species IN (
    'dog', 'cat', 'other', 'unknown',
    'rabbit', 'guinea_pig', 'hamster', 'rat', 'ferret', 'chinchilla',
    'goat', 'sheep', 'pig', 'cow',
    'horse', 'donkey', 'pony',
    'chicken', 'duck', 'goose',
    'parakeet', 'parrot', 'canary',
    'tortoise'
  ));
