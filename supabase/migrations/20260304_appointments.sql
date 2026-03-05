-- ============================================================
-- SDA Refuge — Appointments (Rendez-vous)
-- Migration: 20260304_appointments
-- Gestion des rendez-vous (adoptions, vétérinaire) intégrés au planning
-- A executer dans Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. Table: appointments
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('adoption', 'veterinary')),
  animal_id         UUID REFERENCES animals(id) ON DELETE SET NULL,
  client_name       TEXT NOT NULL,
  client_phone      TEXT,
  client_email      TEXT,
  date              DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  notes             TEXT,
  status            TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
  created_by        UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_appointments_establishment_date
  ON appointments(establishment_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_type
  ON appointments(establishment_id, type);

CREATE INDEX IF NOT EXISTS idx_appointments_animal
  ON appointments(animal_id)
  WHERE animal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_status
  ON appointments(establishment_id, status);

CREATE INDEX IF NOT EXISTS idx_appointments_date_range
  ON appointments(establishment_id, date, start_time);

-- ============================================================
-- 3. Trigger updated_at
-- ============================================================
CREATE TRIGGER tr_appointments_updated
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. RLS policies
-- ============================================================
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Managers/admins can view all appointments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'appointments_select') THEN
    CREATE POLICY "appointments_select" ON appointments FOR SELECT USING (
      user_has_permission(establishment_id, 'manage_establishment')
    );
  END IF;

  -- Managers/admins can create appointments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'appointments_insert') THEN
    CREATE POLICY "appointments_insert" ON appointments FOR INSERT WITH CHECK (
      user_has_permission(establishment_id, 'manage_establishment')
    );
  END IF;

  -- Managers/admins can update appointments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'appointments_update') THEN
    CREATE POLICY "appointments_update" ON appointments FOR UPDATE USING (
      user_has_permission(establishment_id, 'manage_establishment')
    );
  END IF;

  -- Managers/admins can delete appointments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'appointments_delete') THEN
    CREATE POLICY "appointments_delete" ON appointments FOR DELETE USING (
      user_has_permission(establishment_id, 'manage_establishment')
    );
  END IF;
END $$;

-- ============================================================
-- DONE! Appointments schema ready.
-- ============================================================
