-- ============================================================
-- SDA Refuge — Table adoption_applications
-- Migration: 20260303_adoption_applications
-- Permet de stocker les candidatures d'adoption depuis le site public
-- ============================================================

-- ============================================================
-- 1. Table adoption_applications
-- ============================================================
CREATE TABLE adoption_applications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id             UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  establishment_id      UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,

  -- Candidat
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  email                 TEXT NOT NULL,
  phone                 TEXT NOT NULL,
  address               TEXT NOT NULL,
  city                  TEXT NOT NULL,
  postal_code           TEXT NOT NULL,

  -- Situation
  housing_type          TEXT NOT NULL CHECK (housing_type IN ('house', 'apartment', 'other')),
  has_garden            BOOLEAN NOT NULL DEFAULT false,
  has_other_animals     BOOLEAN NOT NULL DEFAULT false,
  other_animals_details TEXT,
  has_experience        BOOLEAN NOT NULL DEFAULT false,
  experience_details    TEXT,

  -- Motivation
  motivation            TEXT NOT NULL,

  -- Suivi
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'cancelled')),
  admin_notes           TEXT,

  -- Dates
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Index pour performance
-- ============================================================
CREATE INDEX idx_adoption_applications_animal ON adoption_applications(animal_id);
CREATE INDEX idx_adoption_applications_status ON adoption_applications(status);
CREATE INDEX idx_adoption_applications_establishment ON adoption_applications(establishment_id);

-- ============================================================
-- 3. RLS Policies
-- ============================================================

-- Enable RLS
ALTER TABLE adoption_applications ENABLE ROW LEVEL SECURITY;

-- Insertion publique (site public peut créer des candidatures)
CREATE POLICY "Anyone can submit adoption application"
ON adoption_applications FOR INSERT
TO anon
WITH CHECK (true);

-- Lecture réservée aux membres de l'établissement
CREATE POLICY "Members can view applications"
ON adoption_applications FOR SELECT
TO authenticated
USING (
  establishment_id IN (
    SELECT establishment_id
    FROM establishment_members
    WHERE user_id = auth.uid()
  )
);

-- Mise à jour réservée aux membres avec permission manage_adoptions
CREATE POLICY "Members can update applications"
ON adoption_applications FOR UPDATE
TO authenticated
USING (
  establishment_id IN (
    SELECT establishment_id
    FROM establishment_members
    WHERE user_id = auth.uid()
  )
  AND user_has_permission(establishment_id, 'manage_adoptions')
)
WITH CHECK (
  establishment_id IN (
    SELECT establishment_id
    FROM establishment_members
    WHERE user_id = auth.uid()
  )
  AND user_has_permission(establishment_id, 'manage_adoptions')
);

-- ============================================================
-- 4. Policy lecture publique animaux adoptables (si pas déjà existante)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'animals' AND policyname = 'Public can view adoptable animals'
  ) THEN
    CREATE POLICY "Public can view adoptable animals"
    ON animals FOR SELECT
    TO anon
    USING (adoptable = true AND status = 'shelter');
  END IF;
END $$;

-- ============================================================
-- DONE! Table adoption_applications ready.
-- ============================================================
