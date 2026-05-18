-- Leave coverage / staffing thresholds
--
-- Adds member contract type, long-term absence tracking, and a per-establishment
-- minimum daily staffing target. Used by the "Couverture" tab in /admin/conges.

ALTER TABLE establishment_members
  ADD COLUMN IF NOT EXISTS contract_type TEXT;

UPDATE establishment_members
SET contract_type = CASE
  WHEN role_type = 'benevole' THEN 'benevole'
  ELSE 'salarie'
END
WHERE contract_type IS NULL;

ALTER TABLE establishment_members
  ALTER COLUMN contract_type SET NOT NULL,
  ALTER COLUMN contract_type SET DEFAULT 'salarie';

ALTER TABLE establishment_members
  DROP CONSTRAINT IF EXISTS establishment_members_contract_type_check;
ALTER TABLE establishment_members
  ADD CONSTRAINT establishment_members_contract_type_check
    CHECK (contract_type IN ('salarie', 'auto_entrepreneur', 'benevole', 'autre'));

ALTER TABLE establishment_members
  ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE establishment_members
  DROP CONSTRAINT IF EXISTS establishment_members_availability_status_check;
ALTER TABLE establishment_members
  ADD CONSTRAINT establishment_members_availability_status_check
    CHECK (availability_status IN ('active', 'on_extended_leave'));

ALTER TABLE establishment_members
  ADD COLUMN IF NOT EXISTS extended_leave_from DATE,
  ADD COLUMN IF NOT EXISTS extended_leave_until DATE,
  ADD COLUMN IF NOT EXISTS extended_leave_reason TEXT;

ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS min_daily_staff INTEGER NOT NULL DEFAULT 3;

ALTER TABLE establishments
  DROP CONSTRAINT IF EXISTS establishments_min_daily_staff_check;
ALTER TABLE establishments
  ADD CONSTRAINT establishments_min_daily_staff_check
    CHECK (min_daily_staff >= 0);

COMMENT ON COLUMN establishment_members.contract_type
  IS 'salarie | auto_entrepreneur | benevole | autre';
COMMENT ON COLUMN establishment_members.availability_status
  IS 'active | on_extended_leave (arret longue duree, exclu de l effectif disponible)';
COMMENT ON COLUMN establishment_members.extended_leave_until
  IS 'Date previsionnelle de retour. NULL = indeterminee. Apres cette date le membre redevient actif.';
COMMENT ON COLUMN establishments.min_daily_staff
  IS 'Effectif salarie minimum requis par jour. Sert d alerte/blocage dans la validation des conges.';
