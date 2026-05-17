-- ============================================================
-- SDA Refuge — Demandes d'adoption publiques
-- Migration: 20260517a_adoption_inquiries
-- ============================================================
-- Crée la table adoption_inquiries pour stocker les demandes
-- d'adoption déposées via le portail public contact.sda-nord.com.
-- Workflow : pending → contacted → rdv_confirmed → rdv_completed
--           → accepted | refused | cancelled
-- ============================================================

CREATE TABLE IF NOT EXISTS adoption_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,

  -- Snapshot demandeur (au moment de la soumission)
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  postal_code TEXT,
  city TEXT,

  -- Questionnaire foyer + expérience + souhait (jsonb flexible)
  questionnaire JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'contacted',
    'rdv_confirmed',
    'rdv_completed',
    'accepted',
    'refused',
    'cancelled'
  )),

  -- Source : public_portal | manual
  source TEXT NOT NULL DEFAULT 'public_portal' CHECK (source IN ('public_portal', 'manual')),

  -- Notes internes équipe + raison refus
  team_notes TEXT,
  refusal_reason TEXT,

  -- Anti-spam / audit
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_adoption_inquiries_establishment_status
  ON adoption_inquiries(establishment_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_adoption_inquiries_animal
  ON adoption_inquiries(animal_id);

CREATE INDEX IF NOT EXISTS idx_adoption_inquiries_email
  ON adoption_inquiries(email);

CREATE INDEX IF NOT EXISTS idx_adoption_inquiries_appointment
  ON adoption_inquiries(appointment_id)
  WHERE appointment_id IS NOT NULL;

-- Trigger updated_at
CREATE TRIGGER tr_adoption_inquiries_updated
  BEFORE UPDATE ON adoption_inquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS : seuls les membres de l'établissement peuvent voir/modifier
ALTER TABLE adoption_inquiries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'adoption_inquiries_select') THEN
    CREATE POLICY "adoption_inquiries_select" ON adoption_inquiries FOR SELECT USING (
      user_has_permission(establishment_id, 'manage_adoptions')
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'adoption_inquiries_update') THEN
    CREATE POLICY "adoption_inquiries_update" ON adoption_inquiries FOR UPDATE USING (
      user_has_permission(establishment_id, 'manage_adoptions')
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'adoption_inquiries_delete') THEN
    CREATE POLICY "adoption_inquiries_delete" ON adoption_inquiries FOR DELETE USING (
      user_has_permission(establishment_id, 'manage_adoptions')
    );
  END IF;
  -- INSERT volontairement omis : seul le code serveur (service_role) insère
END $$;

COMMENT ON TABLE adoption_inquiries IS
  'Demandes d''adoption déposées via le portail public contact.sda-nord.com.
   1 demande = 1 client (créé si nouveau) + 1 appointment (status pending_validation)
   + ce ligne (workflow équipe).';
