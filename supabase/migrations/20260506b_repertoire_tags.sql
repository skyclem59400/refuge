-- =====================================================================
-- Pivot répertoire : tags Adoptant / Famille d'accueil / Adhérent
-- =====================================================================
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS is_adopter   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_foster    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_member    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS member_since DATE;

CREATE INDEX IF NOT EXISTS idx_clients_is_adopter ON clients(establishment_id) WHERE is_adopter = TRUE;
CREATE INDEX IF NOT EXISTS idx_clients_is_foster  ON clients(establishment_id) WHERE is_foster  = TRUE;
CREATE INDEX IF NOT EXISTS idx_clients_is_member  ON clients(establishment_id) WHERE is_member  = TRUE;

UPDATE clients SET is_foster = TRUE WHERE type = 'foster_family' AND is_foster = FALSE;

UPDATE clients SET is_adopter = TRUE
WHERE id IN (
  SELECT DISTINCT adopter_client_id FROM adoption_contracts
  WHERE adopter_client_id IS NOT NULL
)
AND is_adopter = FALSE;

UPDATE clients SET is_member = TRUE WHERE is_adopter = TRUE AND is_member = FALSE;

UPDATE clients c SET member_since = sub.first_adoption
FROM (
  SELECT adopter_client_id, MIN(adoption_date) AS first_adoption
  FROM adoption_contracts
  WHERE adopter_client_id IS NOT NULL
  GROUP BY adopter_client_id
) sub
WHERE c.id = sub.adopter_client_id AND c.member_since IS NULL;

COMMENT ON COLUMN clients.is_adopter IS 'Étiquette Adoptant : a déjà adopté un animal SDA.';
COMMENT ON COLUMN clients.is_foster IS 'Étiquette Famille d''accueil : actuellement FA active.';
COMMENT ON COLUMN clients.is_member IS 'Étiquette Adhérent : adhérent SDA en cours (à renouveler annuellement).';
COMMENT ON COLUMN clients.member_since IS 'Date de la première adhésion (= première adoption habituellement).';
