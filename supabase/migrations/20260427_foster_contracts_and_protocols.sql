-- ============================================================
-- Optimus v2 — Foster contracts & Health protocols
-- Date: 2026-04-27
-- ============================================================
--
-- Adds three feature areas requested by SDA after CRM rollout:
--   1. New movement type 'foster_placement' (pound -> FA direct)
--   2. Foster contracts (convention de placement en famille d'accueil)
--   3. Health protocols (modeles de soins avec rappels calcules)
--
-- Idempotent: can be re-run safely.
-- ============================================================


-- ============================================================
-- 1. Extend animal_movements.type to include foster_placement
-- ============================================================
ALTER TABLE animal_movements DROP CONSTRAINT IF EXISTS animal_movements_type_check;
ALTER TABLE animal_movements ADD CONSTRAINT animal_movements_type_check CHECK (type IN (
  'pound_entry',
  'shelter_transfer',
  'foster_placement',
  'adoption',
  'return_to_owner',
  'transfer_out',
  'death',
  'euthanasia'
));


-- ============================================================
-- 2. Foster contracts
-- ============================================================
-- Convention de placement temporaire en famille d'accueil.
-- Une FA est un client (clients.type = 'foster_family').
-- Un contrat lie un animal a une FA, sur une periode donnee, signe en physique.
CREATE TABLE IF NOT EXISTS foster_contracts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id            UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  animal_id                   UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  foster_client_id            UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  contract_number             TEXT NOT NULL,
  start_date                  DATE NOT NULL,
  expected_end_date           DATE,
  actual_end_date             DATE,
  status                      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                                'draft', 'active', 'ended', 'cancelled'
                              )),
  vet_costs_covered_by_shelter  BOOLEAN NOT NULL DEFAULT true,
  food_provided_by_shelter      BOOLEAN NOT NULL DEFAULT false,
  insurance_required            BOOLEAN NOT NULL DEFAULT false,
  household_consent             BOOLEAN NOT NULL DEFAULT false,
  other_animals_at_home         TEXT,
  special_conditions            TEXT,
  signed_at_location            TEXT,
  signed_at                     DATE,
  notes                         TEXT,
  pdf_url                       TEXT,
  created_by                    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, contract_number)
);

CREATE INDEX IF NOT EXISTS idx_foster_contracts_establishment ON foster_contracts(establishment_id);
CREATE INDEX IF NOT EXISTS idx_foster_contracts_animal ON foster_contracts(animal_id);
CREATE INDEX IF NOT EXISTS idx_foster_contracts_foster_client ON foster_contracts(foster_client_id);
CREATE INDEX IF NOT EXISTS idx_foster_contracts_status ON foster_contracts(status);

CREATE OR REPLACE TRIGGER tr_foster_contracts_updated
  BEFORE UPDATE ON foster_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-numbering function: CFA-YYYY-NNN per establishment
CREATE OR REPLACE FUNCTION get_next_foster_contract_number(est_id UUID)
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_seq INT;
  number_str TEXT;
BEGIN
  current_year := to_char(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(contract_number FROM 'CFA-' || current_year || '-(\d+)$') AS INTEGER
    )
  ), 0) + 1
  INTO next_seq
  FROM foster_contracts
  WHERE establishment_id = est_id
    AND contract_number LIKE 'CFA-' || current_year || '-%';

  number_str := 'CFA-' || current_year || '-' || LPAD(next_seq::TEXT, 3, '0');
  RETURN number_str;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE foster_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "foster_contracts_select" ON foster_contracts;
DROP POLICY IF EXISTS "foster_contracts_insert" ON foster_contracts;
DROP POLICY IF EXISTS "foster_contracts_update" ON foster_contracts;
DROP POLICY IF EXISTS "foster_contracts_delete" ON foster_contracts;

CREATE POLICY "foster_contracts_select" ON foster_contracts FOR SELECT USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "foster_contracts_insert" ON foster_contracts FOR INSERT WITH CHECK (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "foster_contracts_update" ON foster_contracts FOR UPDATE USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "foster_contracts_delete" ON foster_contracts FOR DELETE USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);


-- ============================================================
-- 3. Health protocols (modeles de soins)
-- ============================================================
-- Un protocole = un modele de suite de soins (ex: "Vaccination chiot CHPPiL").
-- Une etape = un acte type (vaccin, rappel, antiparasitaire) avec offset en jours.
-- Une instance = application d'un protocole a un animal a une date donnee.
-- Lors de l'application, le systeme genere les animal_health_records correspondants
-- avec next_due_date calculee.

CREATE TABLE IF NOT EXISTS health_protocols (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id    UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  applicable_species  TEXT NOT NULL DEFAULT 'both' CHECK (applicable_species IN ('cat', 'dog', 'both')),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_protocols_establishment ON health_protocols(establishment_id);
CREATE INDEX IF NOT EXISTS idx_health_protocols_active ON health_protocols(is_active);

CREATE OR REPLACE TRIGGER tr_health_protocols_updated
  BEFORE UPDATE ON health_protocols
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


CREATE TABLE IF NOT EXISTS health_protocol_steps (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id         UUID NOT NULL REFERENCES health_protocols(id) ON DELETE CASCADE,
  step_order          INT NOT NULL,
  label               TEXT NOT NULL,
  health_record_type  TEXT NOT NULL CHECK (health_record_type IN (
                        'vaccination', 'sterilization', 'antiparasitic',
                        'consultation', 'surgery', 'medication', 'behavioral_assessment'
                      )),
  offset_days         INT NOT NULL DEFAULT 0,
  recurrence_days     INT,
  description         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(protocol_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_protocol_steps_protocol ON health_protocol_steps(protocol_id);


CREATE TABLE IF NOT EXISTS animal_protocol_instances (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id           UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  protocol_id         UUID NOT NULL REFERENCES health_protocols(id) ON DELETE RESTRICT,
  start_date          DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes               TEXT,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_protocol_instances_animal ON animal_protocol_instances(animal_id);
CREATE INDEX IF NOT EXISTS idx_protocol_instances_protocol ON animal_protocol_instances(protocol_id);

CREATE OR REPLACE TRIGGER tr_protocol_instances_updated
  BEFORE UPDATE ON animal_protocol_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- Link table: which health_records were generated by which protocol instance/step
ALTER TABLE animal_health_records
  ADD COLUMN IF NOT EXISTS protocol_instance_id UUID REFERENCES animal_protocol_instances(id) ON DELETE SET NULL;
ALTER TABLE animal_health_records
  ADD COLUMN IF NOT EXISTS protocol_step_id UUID REFERENCES health_protocol_steps(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_health_records_protocol_instance ON animal_health_records(protocol_instance_id);


-- ============================================================
-- 4. RLS for protocols
-- ============================================================
ALTER TABLE health_protocols ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "health_protocols_select" ON health_protocols;
DROP POLICY IF EXISTS "health_protocols_insert" ON health_protocols;
DROP POLICY IF EXISTS "health_protocols_update" ON health_protocols;
DROP POLICY IF EXISTS "health_protocols_delete" ON health_protocols;

CREATE POLICY "health_protocols_select" ON health_protocols FOR SELECT USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "health_protocols_insert" ON health_protocols FOR INSERT WITH CHECK (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "health_protocols_update" ON health_protocols FOR UPDATE USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "health_protocols_delete" ON health_protocols FOR DELETE USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);


ALTER TABLE health_protocol_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "health_protocol_steps_select" ON health_protocol_steps;
DROP POLICY IF EXISTS "health_protocol_steps_insert" ON health_protocol_steps;
DROP POLICY IF EXISTS "health_protocol_steps_update" ON health_protocol_steps;
DROP POLICY IF EXISTS "health_protocol_steps_delete" ON health_protocol_steps;

CREATE POLICY "health_protocol_steps_select" ON health_protocol_steps FOR SELECT USING (
  protocol_id IN (
    SELECT id FROM health_protocols WHERE establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "health_protocol_steps_insert" ON health_protocol_steps FOR INSERT WITH CHECK (
  protocol_id IN (
    SELECT id FROM health_protocols WHERE establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "health_protocol_steps_update" ON health_protocol_steps FOR UPDATE USING (
  protocol_id IN (
    SELECT id FROM health_protocols WHERE establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "health_protocol_steps_delete" ON health_protocol_steps FOR DELETE USING (
  protocol_id IN (
    SELECT id FROM health_protocols WHERE establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  )
);


ALTER TABLE animal_protocol_instances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "animal_protocol_instances_select" ON animal_protocol_instances;
DROP POLICY IF EXISTS "animal_protocol_instances_insert" ON animal_protocol_instances;
DROP POLICY IF EXISTS "animal_protocol_instances_update" ON animal_protocol_instances;
DROP POLICY IF EXISTS "animal_protocol_instances_delete" ON animal_protocol_instances;

CREATE POLICY "animal_protocol_instances_select" ON animal_protocol_instances FOR SELECT USING (
  animal_id IN (SELECT id FROM animals WHERE establishment_id IN (
    SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "animal_protocol_instances_insert" ON animal_protocol_instances FOR INSERT WITH CHECK (
  animal_id IN (SELECT id FROM animals WHERE establishment_id IN (
    SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "animal_protocol_instances_update" ON animal_protocol_instances FOR UPDATE USING (
  animal_id IN (SELECT id FROM animals WHERE establishment_id IN (
    SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "animal_protocol_instances_delete" ON animal_protocol_instances FOR DELETE USING (
  animal_id IN (SELECT id FROM animals WHERE establishment_id IN (
    SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
  ))
);


-- ============================================================
-- 5. Default seed protocols (only inserted if establishment has none)
-- Gives equipes a starting point. They can edit / disable freely.
-- ============================================================
DO $$
DECLARE
  est RECORD;
  proto_id UUID;
BEGIN
  FOR est IN SELECT id FROM establishments LOOP
    -- Skip if establishment already has protocols
    IF EXISTS (SELECT 1 FROM health_protocols WHERE establishment_id = est.id) THEN
      CONTINUE;
    END IF;

    -- Vaccination chiot
    INSERT INTO health_protocols (establishment_id, name, description, applicable_species)
    VALUES (
      est.id,
      'Vaccination chiot (CHPPiL + Rage)',
      'Primovaccination chiot avec rappels',
      'dog'
    ) RETURNING id INTO proto_id;
    INSERT INTO health_protocol_steps (protocol_id, step_order, label, health_record_type, offset_days, recurrence_days, description) VALUES
      (proto_id, 1, '1ere injection CHPPiL',         'vaccination', 0,   NULL, 'Premiere injection vaccin chiot'),
      (proto_id, 2, 'Rappel CHPPiL + Rage',           'vaccination', 28,  NULL, 'Rappel a 4 semaines'),
      (proto_id, 3, 'Rappel annuel',                  'vaccination', 365, 365,  'Rappel annuel');

    -- Vaccination chaton
    INSERT INTO health_protocols (establishment_id, name, description, applicable_species)
    VALUES (
      est.id,
      'Vaccination chaton (TCL + Leucose)',
      'Primovaccination chaton avec rappels',
      'cat'
    ) RETURNING id INTO proto_id;
    INSERT INTO health_protocol_steps (protocol_id, step_order, label, health_record_type, offset_days, recurrence_days, description) VALUES
      (proto_id, 1, '1ere injection TCL',             'vaccination', 0,   NULL, 'Premiere injection vaccin chaton'),
      (proto_id, 2, 'Rappel TCL + Leucose',           'vaccination', 28,  NULL, 'Rappel a 4 semaines'),
      (proto_id, 3, 'Rappel annuel',                  'vaccination', 365, 365,  'Rappel annuel');

    -- Antiparasitaire trimestriel
    INSERT INTO health_protocols (establishment_id, name, description, applicable_species)
    VALUES (
      est.id,
      'Antiparasitaire trimestriel',
      'Traitement antiparasitaire interne et externe tous les 3 mois',
      'both'
    ) RETURNING id INTO proto_id;
    INSERT INTO health_protocol_steps (protocol_id, step_order, label, health_record_type, offset_days, recurrence_days, description) VALUES
      (proto_id, 1, 'Antiparasitaire',                'antiparasitic', 0,  90, 'Renouveler tous les 3 mois');

    -- Sterilisation post-op
    INSERT INTO health_protocols (establishment_id, name, description, applicable_species)
    VALUES (
      est.id,
      'Sterilisation et suivi post-op',
      'Sterilisation chirurgicale + controle post-op',
      'both'
    ) RETURNING id INTO proto_id;
    INSERT INTO health_protocol_steps (protocol_id, step_order, label, health_record_type, offset_days, recurrence_days, description) VALUES
      (proto_id, 1, 'Sterilisation',                  'sterilization', 0,   NULL, 'Intervention chirurgicale'),
      (proto_id, 2, 'Controle post-op',               'consultation',  10,  NULL, 'Visite de controle a J+10');
  END LOOP;
END $$;


-- ============================================================
-- 6. RPC : apply_protocol_to_animal
-- Generates animal_health_records from a protocol at a given start date.
-- ============================================================
CREATE OR REPLACE FUNCTION apply_protocol_to_animal(
  p_animal_id UUID,
  p_protocol_id UUID,
  p_start_date DATE,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  instance_id UUID;
  step RECORD;
  computed_date DATE;
  next_due DATE;
BEGIN
  -- Create instance
  INSERT INTO animal_protocol_instances (animal_id, protocol_id, start_date, status, created_by)
  VALUES (p_animal_id, p_protocol_id, p_start_date, 'active', p_user_id)
  RETURNING id INTO instance_id;

  -- For each step, create the corresponding health record with computed date
  FOR step IN
    SELECT * FROM health_protocol_steps WHERE protocol_id = p_protocol_id ORDER BY step_order
  LOOP
    computed_date := p_start_date + (step.offset_days || ' days')::INTERVAL;

    -- next_due_date = own date + recurrence_days if recurrence, else null
    IF step.recurrence_days IS NOT NULL THEN
      next_due := computed_date + (step.recurrence_days || ' days')::INTERVAL;
    ELSE
      next_due := NULL;
    END IF;

    INSERT INTO animal_health_records (
      animal_id, type, date, description, next_due_date,
      protocol_instance_id, protocol_step_id, created_by
    ) VALUES (
      p_animal_id,
      step.health_record_type,
      computed_date,
      step.label || COALESCE(' - ' || step.description, ''),
      next_due,
      instance_id,
      step.id,
      p_user_id
    );
  END LOOP;

  RETURN instance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
