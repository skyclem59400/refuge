-- Link a movement (adoption / foster placement / return to owner) to a client
-- in the directory. Optional: text fields person_name / person_contact stay
-- as a snapshot in case the client is later deleted.

ALTER TABLE animal_movements
  ADD COLUMN IF NOT EXISTS related_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_animal_movements_related_client
  ON animal_movements(related_client_id);
