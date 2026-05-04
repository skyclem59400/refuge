-- Link a movement to its underlying signature workflow.
-- For foster_placement and adoption, a movement is only "active" once the
-- corresponding contract has been signed (electronically or manually).
-- Migration appliquée sur Supabase prod le 2026-05-04.

ALTER TABLE animal_movements
  ADD COLUMN IF NOT EXISTS signature_status TEXT
    CHECK (signature_status IN ('not_required', 'pending', 'signed', 'rejected', 'cancelled')),
  ADD COLUMN IF NOT EXISTS related_contract_id UUID,
  ADD COLUMN IF NOT EXISTS related_contract_type TEXT
    CHECK (related_contract_type IN ('foster', 'adoption'));

UPDATE animal_movements
  SET signature_status = 'not_required'
WHERE signature_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_animal_movements_signature_status
  ON animal_movements(signature_status);
CREATE INDEX IF NOT EXISTS idx_animal_movements_related_contract
  ON animal_movements(related_contract_id, related_contract_type);
