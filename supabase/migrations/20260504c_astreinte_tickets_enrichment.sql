-- =====================================================================
-- Lot 02 : enrichissement des tickets astreinte
-- =====================================================================
-- Ajoute :
--   - champs animal (species, count, size, color, breed, injured, dangerous, owner_known)
--   - champs réquisition (authority, officer, PV, motif)
--   - champs vétérinaire (clinic, emergency_type)
--   - assignation (assigned_to, assigned_at)
--   - priorité (low/normal/high/critical)
--   - table astreinte_ticket_photos (1-N photos par ticket)
--   - table astreinte_ticket_events (timeline / audit log)
--   - triggers automatiques (event "created" à l'insert, event "status_changed" à l'update)
--   - RLS pour que le déclarant lise ses tickets/photos/events
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enrichissement astreinte_tickets
-- ---------------------------------------------------------------------
ALTER TABLE astreinte_tickets
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,

  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),

  ADD COLUMN IF NOT EXISTS animal_species TEXT
    CHECK (animal_species IN ('dog', 'cat', 'other', 'unknown')),
  ADD COLUMN IF NOT EXISTS animal_count INTEGER NOT NULL DEFAULT 1
    CHECK (animal_count >= 1),
  ADD COLUMN IF NOT EXISTS animal_size TEXT
    CHECK (animal_size IN ('small', 'medium', 'large', 'unknown')),
  ADD COLUMN IF NOT EXISTS animal_color TEXT,
  ADD COLUMN IF NOT EXISTS animal_breed TEXT,
  ADD COLUMN IF NOT EXISTS animal_injured BOOLEAN,
  ADD COLUMN IF NOT EXISTS animal_dangerous BOOLEAN,
  ADD COLUMN IF NOT EXISTS animal_owner_known BOOLEAN,

  ADD COLUMN IF NOT EXISTS requisition_authority TEXT
    CHECK (requisition_authority IN ('police_municipale', 'police_nationale', 'gendarmerie', 'parquet', 'mairie', 'other')),
  ADD COLUMN IF NOT EXISTS requisition_officer_name TEXT,
  ADD COLUMN IF NOT EXISTS requisition_pv_number TEXT,
  ADD COLUMN IF NOT EXISTS requisition_judicial_grounds TEXT,

  ADD COLUMN IF NOT EXISTS veterinary_clinic_name TEXT,
  ADD COLUMN IF NOT EXISTS veterinary_emergency_type TEXT;

-- ---------------------------------------------------------------------
-- 2. Précision espèce "Autre" (slug : horse, cow, snake, hedgehog, etc.)
-- ---------------------------------------------------------------------
ALTER TABLE astreinte_tickets
  ADD COLUMN IF NOT EXISTS animal_species_other TEXT;

-- ---------------------------------------------------------------------
-- 3. Profil enrichi du déclarant
-- ---------------------------------------------------------------------
ALTER TABLE astreinte_tickets
  ADD COLUMN IF NOT EXISTS declarant_type TEXT
    CHECK (declarant_type IN ('elected', 'municipal_agent', 'law_enforcement', 'veterinarian', 'other')),
  ADD COLUMN IF NOT EXISTS declarant_unit TEXT;

-- ---------------------------------------------------------------------
-- 4. Table astreinte_ticket_photos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS astreinte_ticket_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID NOT NULL REFERENCES astreinte_tickets(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER,
  width         INTEGER,
  height        INTEGER,
  uploaded_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_astreinte_ticket_photos_ticket
  ON astreinte_ticket_photos(ticket_id);

-- ---------------------------------------------------------------------
-- 5. Table astreinte_ticket_events (timeline / audit log)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS astreinte_ticket_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID NOT NULL REFERENCES astreinte_tickets(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL
    CHECK (event_type IN (
      'created', 'acknowledged', 'assigned', 'status_changed',
      'priority_changed', 'photo_added', 'comment', 'completed', 'cancelled'
    )),
  performed_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message       TEXT,
  metadata      JSONB,
  visible_to_declarant BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_astreinte_ticket_events_ticket_created
  ON astreinte_ticket_events(ticket_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 6. Triggers automatiques
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION astreinte_ticket_after_insert_event()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO astreinte_ticket_events (ticket_id, event_type, performed_by, message)
  VALUES (
    NEW.id, 'created', NEW.declarant_user_id,
    'Ticket créé par ' || COALESCE(NEW.declarant_email, 'inconnu')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_astreinte_ticket_after_insert ON astreinte_tickets;
CREATE TRIGGER trg_astreinte_ticket_after_insert
  AFTER INSERT ON astreinte_tickets
  FOR EACH ROW EXECUTE FUNCTION astreinte_ticket_after_insert_event();

CREATE OR REPLACE FUNCTION astreinte_ticket_after_update_event()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO astreinte_ticket_events (ticket_id, event_type, performed_by, message, metadata)
    VALUES (
      NEW.id,
      CASE
        WHEN NEW.status = 'acknowledged' THEN 'acknowledged'
        WHEN NEW.status = 'completed'    THEN 'completed'
        WHEN NEW.status = 'cancelled'    THEN 'cancelled'
        ELSE 'status_changed'
      END,
      NEW.acknowledged_by,
      'Statut : ' || OLD.status || ' → ' || NEW.status,
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO astreinte_ticket_events (ticket_id, event_type, performed_by, message, metadata)
    VALUES (NEW.id, 'assigned', NEW.assigned_to, 'Ticket assigné',
            jsonb_build_object('assigned_to', NEW.assigned_to));
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO astreinte_ticket_events (ticket_id, event_type, performed_by, message, metadata)
    VALUES (NEW.id, 'priority_changed', NULL,
            'Priorité : ' || OLD.priority || ' → ' || NEW.priority,
            jsonb_build_object('from', OLD.priority, 'to', NEW.priority));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_astreinte_ticket_after_update ON astreinte_tickets;
CREATE TRIGGER trg_astreinte_ticket_after_update
  AFTER UPDATE ON astreinte_tickets
  FOR EACH ROW EXECUTE FUNCTION astreinte_ticket_after_update_event();

-- ---------------------------------------------------------------------
-- 7. RLS — déclarant lit ses tickets/photos/events
-- ---------------------------------------------------------------------
ALTER TABLE astreinte_tickets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE astreinte_ticket_photos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE astreinte_ticket_events  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Declarant reads own tickets" ON astreinte_tickets;
CREATE POLICY "Declarant reads own tickets" ON astreinte_tickets
  FOR SELECT TO authenticated
  USING (declarant_user_id = auth.uid());

DROP POLICY IF EXISTS "Declarant reads own ticket photos" ON astreinte_ticket_photos;
CREATE POLICY "Declarant reads own ticket photos" ON astreinte_ticket_photos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM astreinte_tickets t WHERE t.id = ticket_id AND t.declarant_user_id = auth.uid()));

DROP POLICY IF EXISTS "Declarant reads own ticket events" ON astreinte_ticket_events;
CREATE POLICY "Declarant reads own ticket events" ON astreinte_ticket_events
  FOR SELECT TO authenticated
  USING (visible_to_declarant = TRUE
    AND EXISTS (SELECT 1 FROM astreinte_tickets t WHERE t.id = ticket_id AND t.declarant_user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- 8. Storage bucket astreinte-photos (privé, 5 Mo max, JPEG/PNG/HEIC/WebP)
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('astreinte-photos', 'astreinte-photos', false, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 9. Index pour requêtes courantes
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_astreinte_tickets_declarant
  ON astreinte_tickets(declarant_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_astreinte_tickets_assigned
  ON astreinte_tickets(assigned_to, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_astreinte_tickets_status_created
  ON astreinte_tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_astreinte_tickets_municipality
  ON astreinte_tickets(municipality_code_insee, created_at DESC);
