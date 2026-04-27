-- ============================================================
-- Optimus v2.1 — Veterinarians, clinics & identification
-- Date: 2026-04-27 (b)
-- ============================================================
--
-- Adds proper veterinary clinic + practitioner architecture:
--   - veterinary_clinics : an external structure (clinic, hospital)
--   - veterinarians      : a practitioner attached to a clinic
--   - link health records to a specific practitioner (FK)
--   - link identification on the animal to a practitioner + a date
--
-- Idempotent: safe to re-run.
-- ============================================================


-- ============================================================
-- 1. Veterinary clinics
-- ============================================================
CREATE TABLE IF NOT EXISTS veterinary_clinics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  address           TEXT,
  postal_code       TEXT,
  city              TEXT,
  phone             TEXT,
  email             TEXT,
  website           TEXT,
  siret             TEXT,
  notes             TEXT,
  is_default        BOOLEAN NOT NULL DEFAULT false,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vet_clinics_establishment ON veterinary_clinics(establishment_id);
CREATE INDEX IF NOT EXISTS idx_vet_clinics_active ON veterinary_clinics(is_active);

CREATE OR REPLACE TRIGGER tr_vet_clinics_updated
  BEFORE UPDATE ON veterinary_clinics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 2. Veterinarians (practitioners)
-- ============================================================
CREATE TABLE IF NOT EXISTS veterinarians (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID NOT NULL REFERENCES veterinary_clinics(id) ON DELETE CASCADE,
  first_name          TEXT,
  last_name           TEXT NOT NULL,
  ordre_number        TEXT,
  specialty           TEXT,
  phone               TEXT,
  email               TEXT,
  is_referent         BOOLEAN NOT NULL DEFAULT false,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_veterinarians_clinic ON veterinarians(clinic_id);
CREATE INDEX IF NOT EXISTS idx_veterinarians_active ON veterinarians(is_active);
CREATE INDEX IF NOT EXISTS idx_veterinarians_referent ON veterinarians(is_referent);

CREATE OR REPLACE TRIGGER tr_veterinarians_updated
  BEFORE UPDATE ON veterinarians
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 3. Link health records to a veterinarian (FK in addition to legacy free-text field)
-- ============================================================
ALTER TABLE animal_health_records
  ADD COLUMN IF NOT EXISTS veterinarian_id UUID REFERENCES veterinarians(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_health_records_veterinarian ON animal_health_records(veterinarian_id);


-- ============================================================
-- 4. Identification metadata on animal
-- ============================================================
ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS identification_date DATE,
  ADD COLUMN IF NOT EXISTS identifying_veterinarian_id UUID REFERENCES veterinarians(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_animals_identifying_vet ON animals(identifying_veterinarian_id);


-- ============================================================
-- 5. RLS — clinics & veterinarians
-- ============================================================
ALTER TABLE veterinary_clinics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "veterinary_clinics_select" ON veterinary_clinics;
DROP POLICY IF EXISTS "veterinary_clinics_insert" ON veterinary_clinics;
DROP POLICY IF EXISTS "veterinary_clinics_update" ON veterinary_clinics;
DROP POLICY IF EXISTS "veterinary_clinics_delete" ON veterinary_clinics;

CREATE POLICY "veterinary_clinics_select" ON veterinary_clinics FOR SELECT USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "veterinary_clinics_insert" ON veterinary_clinics FOR INSERT WITH CHECK (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "veterinary_clinics_update" ON veterinary_clinics FOR UPDATE USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "veterinary_clinics_delete" ON veterinary_clinics FOR DELETE USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);


ALTER TABLE veterinarians ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "veterinarians_select" ON veterinarians;
DROP POLICY IF EXISTS "veterinarians_insert" ON veterinarians;
DROP POLICY IF EXISTS "veterinarians_update" ON veterinarians;
DROP POLICY IF EXISTS "veterinarians_delete" ON veterinarians;

CREATE POLICY "veterinarians_select" ON veterinarians FOR SELECT USING (
  clinic_id IN (
    SELECT id FROM veterinary_clinics WHERE establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "veterinarians_insert" ON veterinarians FOR INSERT WITH CHECK (
  clinic_id IN (
    SELECT id FROM veterinary_clinics WHERE establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "veterinarians_update" ON veterinarians FOR UPDATE USING (
  clinic_id IN (
    SELECT id FROM veterinary_clinics WHERE establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "veterinarians_delete" ON veterinarians FOR DELETE USING (
  clinic_id IN (
    SELECT id FROM veterinary_clinics WHERE establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  )
);


-- ============================================================
-- 6. RPC : scan health reminders and create notifications
-- Called daily (or on demand). Scans animal_health_records with
-- next_due_date in [today; today+7], and creates a notification
-- of type 'health_reminder' for managers (manage_health permission)
-- of the establishment, if not already notified for this record/window.
-- ============================================================
CREATE OR REPLACE FUNCTION scan_health_reminders()
RETURNS INT AS $$
DECLARE
  rec RECORD;
  manager RECORD;
  notif_count INT := 0;
  already_exists BOOLEAN;
BEGIN
  FOR rec IN
    SELECT
      hr.id              AS record_id,
      hr.animal_id,
      hr.type,
      hr.description,
      hr.next_due_date,
      a.name             AS animal_name,
      a.establishment_id
    FROM animal_health_records hr
    JOIN animals a ON a.id = hr.animal_id
    WHERE hr.next_due_date IS NOT NULL
      AND hr.next_due_date >= CURRENT_DATE
      AND hr.next_due_date <= CURRENT_DATE + INTERVAL '7 days'
  LOOP
    -- For each manager of the establishment with manage_health permission
    FOR manager IN
      SELECT DISTINCT em.user_id
      FROM establishment_members em
      LEFT JOIN member_groups mg ON mg.member_id = em.id
      LEFT JOIN permission_groups pg ON pg.id = mg.group_id
      WHERE em.establishment_id = rec.establishment_id
        AND (
          em.role_type = 'admin'
          OR em.is_owner = true
          OR pg.manage_health = true
        )
    LOOP
      -- Avoid duplicate notification for same record + user + within 6 days
      SELECT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = manager.user_id
          AND type = 'health_reminder'
          AND metadata->>'record_id' = rec.record_id::TEXT
          AND created_at > NOW() - INTERVAL '6 days'
      ) INTO already_exists;

      IF NOT already_exists THEN
        INSERT INTO notifications (
          establishment_id, user_id, type, title, body, link, metadata
        ) VALUES (
          rec.establishment_id,
          manager.user_id,
          'health_reminder',
          'Rappel sante : ' || rec.animal_name,
          'Echeance le ' || to_char(rec.next_due_date, 'DD/MM/YYYY') || ' — ' || COALESCE(rec.description, rec.type),
          '/animals/' || rec.animal_id,
          jsonb_build_object('record_id', rec.record_id, 'animal_id', rec.animal_id, 'due_date', rec.next_due_date)
        );
        notif_count := notif_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN notif_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
