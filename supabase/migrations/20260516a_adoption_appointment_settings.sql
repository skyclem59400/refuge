-- ============================================================
-- SDA Refuge — Paramétrage prise de RDV adoption (publique)
-- Migration: 20260516a_adoption_appointment_settings
-- ============================================================
-- Objectif :
--   1. Ajouter la colonne adoption_appointment_settings sur establishments
--      (jsonb) pour stocker : collaborateurs habilités, plages d'ouverture
--      par jour de la semaine, durée du créneau, anticipation min/max.
--   2. Ajouter le statut 'pending_validation' à appointments.status
--   3. Ajouter une colonne 'source' sur appointments pour distinguer
--      les demandes du portail public des créations manuelles.
-- ============================================================

-- ============================================================
-- 1. Colonne adoption_appointment_settings sur establishments
-- ============================================================
ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS adoption_appointment_settings jsonb NOT NULL DEFAULT jsonb_build_object(
    'enabled', false,
    'allowed_user_ids', '[]'::jsonb,
    'slot_duration_minutes', 45,
    'min_advance_days', 2,
    'max_advance_days', 30,
    'opening_hours', jsonb_build_object(
      'mon', jsonb_build_array(jsonb_build_object('start', '14:00', 'end', '17:00')),
      'tue', jsonb_build_array(jsonb_build_object('start', '14:00', 'end', '17:00')),
      'wed', jsonb_build_array(jsonb_build_object('start', '14:00', 'end', '17:00')),
      'thu', jsonb_build_array(jsonb_build_object('start', '14:00', 'end', '17:00')),
      'fri', jsonb_build_array(jsonb_build_object('start', '14:00', 'end', '17:00')),
      'sat', jsonb_build_array(jsonb_build_object('start', '14:00', 'end', '17:00')),
      'sun', '[]'::jsonb
    ),
    'closed_dates', '[]'::jsonb
  );

COMMENT ON COLUMN establishments.adoption_appointment_settings IS
  'Paramétrage de la prise de RDV adoption depuis le portail public. Structure : { enabled, allowed_user_ids[], slot_duration_minutes, min_advance_days, max_advance_days, opening_hours: { mon|tue|...: [{start,end}] }, closed_dates: ["2026-12-25", ...] }';

-- ============================================================
-- 2. Relax le CHECK constraint sur appointments.status
--    pour accepter 'pending_validation'
-- ============================================================
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('pending_validation', 'scheduled', 'confirmed', 'completed', 'cancelled'));

-- ============================================================
-- 3. Colonne source sur appointments
--    'manual' : créé depuis le CRM
--    'public_portal' : créé depuis contact.sda-nord.com
-- ============================================================
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'public_portal'));

CREATE INDEX IF NOT EXISTS idx_appointments_status_pending
  ON appointments(establishment_id, status, date)
  WHERE status = 'pending_validation';

-- ============================================================
-- DONE.
-- ============================================================
