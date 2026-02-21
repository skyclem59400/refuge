-- ============================================================
-- SDA Estormel — I-CAD Declarations tracking
-- Migration: 20260221_icad
-- ============================================================

-- ============================================================
-- 1. I-CAD declarations table
-- ============================================================
CREATE TABLE IF NOT EXISTS icad_declarations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id         UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  movement_id       UUID REFERENCES animal_movements(id) ON DELETE SET NULL,

  -- Declaration details
  declaration_type  TEXT NOT NULL CHECK (declaration_type IN (
    'pound_entry', 'shelter_transfer', 'adoption',
    'return_to_owner', 'transfer_out', 'death', 'euthanasia',
    'identification', 'owner_change', 'address_change'
  )),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'submitted', 'confirmed', 'rejected', 'error', 'not_required'
  )),

  -- I-CAD reference
  icad_reference    TEXT,
  submitted_at      TIMESTAMPTZ,
  confirmed_at      TIMESTAMPTZ,

  -- Error tracking
  error_message     TEXT,
  retry_count       INT NOT NULL DEFAULT 0,

  -- Metadata
  notes             TEXT,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_icad_animal ON icad_declarations(animal_id);
CREATE INDEX IF NOT EXISTS idx_icad_status ON icad_declarations(status);
CREATE INDEX IF NOT EXISTS idx_icad_movement ON icad_declarations(movement_id);
CREATE INDEX IF NOT EXISTS idx_icad_type ON icad_declarations(declaration_type);

-- ============================================================
-- 3. Trigger: updated_at
-- ============================================================
CREATE TRIGGER tr_icad_declarations_updated
  BEFORE UPDATE ON icad_declarations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. RLS policies
-- ============================================================
ALTER TABLE icad_declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "icad_declarations_select" ON icad_declarations
  FOR SELECT USING (
    animal_id IN (
      SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "icad_declarations_insert" ON icad_declarations
  FOR INSERT WITH CHECK (
    animal_id IN (
      SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "icad_declarations_update" ON icad_declarations
  FOR UPDATE USING (
    animal_id IN (
      SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "icad_declarations_delete" ON icad_declarations
  FOR DELETE USING (
    animal_id IN (
      SELECT id FROM animals WHERE establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    )
  );
