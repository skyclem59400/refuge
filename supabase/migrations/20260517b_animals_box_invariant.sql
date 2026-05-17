-- Invariant : un animal ne peut occuper un box que s'il est physiquement
-- présent au refuge (statuts shelter, pound, boarding). Pour tous les autres
-- statuts (foster_family, adopted, returned, transferred, deceased, euthanized),
-- box_id doit être NULL.
--
-- On utilise un trigger BEFORE INSERT OR UPDATE qui force box_id = NULL
-- si le statut n'est pas dans la liste des "présents physiquement".
-- Cela couvre tous les chemins d'écriture (server actions, SQL direct, UI).

CREATE OR REPLACE FUNCTION enforce_animals_box_invariant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.box_id IS NOT NULL
     AND NEW.status NOT IN ('shelter', 'pound', 'boarding') THEN
    NEW.box_id := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_animals_box_invariant ON animals;

CREATE TRIGGER trg_animals_box_invariant
  BEFORE INSERT OR UPDATE OF status, box_id ON animals
  FOR EACH ROW
  WHEN (NEW.box_id IS NOT NULL)
  EXECUTE FUNCTION enforce_animals_box_invariant();

-- Backfill : nettoie tout box_id résiduel sur les animaux non-présents
-- (devrait être 0 ligne sur SDA, mais on sécurise pour les autres etabs)
UPDATE animals
SET box_id = NULL, updated_at = now()
WHERE box_id IS NOT NULL
  AND status NOT IN ('shelter', 'pound', 'boarding');
