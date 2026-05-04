-- =====================================================================
-- Astreinte Lot 03 — Workflow d'intervention granulaire + compte-rendu
-- =====================================================================
-- - Ajoute statuts on_route / on_site
-- - Timestamps fins (on_route_at, on_site_at) pour calculer durées
-- - Champs compte-rendu d'intervention (outcome, destination, comments, PDF)
-- - Trace d'envoi email (report_sent_at, report_sent_to)
-- =====================================================================

ALTER TABLE astreinte_tickets DROP CONSTRAINT IF EXISTS astreinte_tickets_status_check;
ALTER TABLE astreinte_tickets ADD CONSTRAINT astreinte_tickets_status_check
  CHECK (status IN ('new', 'acknowledged', 'on_route', 'on_site', 'in_progress', 'completed', 'cancelled'));

ALTER TABLE astreinte_tickets
  ADD COLUMN IF NOT EXISTS on_route_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS on_route_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS on_site_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS on_site_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE astreinte_tickets
  ADD COLUMN IF NOT EXISTS intervention_outcome TEXT
    CHECK (intervention_outcome IN ('animal_recovered', 'not_found', 'refused', 'deceased', 'transferred_owner', 'other')),
  ADD COLUMN IF NOT EXISTS intervention_destination TEXT
    CHECK (intervention_destination IN ('refuge_sda', 'veterinary', 'owner_returned', 'euthanasia', 'on_site_release', 'other')),
  ADD COLUMN IF NOT EXISTS intervention_comments TEXT,
  ADD COLUMN IF NOT EXISTS report_pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS report_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS report_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS report_sent_to TEXT[];

ALTER TABLE astreinte_ticket_events DROP CONSTRAINT IF EXISTS astreinte_ticket_events_event_type_check;
ALTER TABLE astreinte_ticket_events ADD CONSTRAINT astreinte_ticket_events_event_type_check
  CHECK (event_type IN (
    'created', 'acknowledged', 'assigned', 'status_changed',
    'priority_changed', 'photo_added', 'comment',
    'on_route', 'on_site', 'completed', 'cancelled', 'report_sent'
  ));

CREATE OR REPLACE FUNCTION astreinte_ticket_after_update_event()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO astreinte_ticket_events (ticket_id, event_type, performed_by, message, metadata)
    VALUES (
      NEW.id,
      CASE
        WHEN NEW.status = 'acknowledged' THEN 'acknowledged'
        WHEN NEW.status = 'on_route'     THEN 'on_route'
        WHEN NEW.status = 'on_site'      THEN 'on_site'
        WHEN NEW.status = 'completed'    THEN 'completed'
        WHEN NEW.status = 'cancelled'    THEN 'cancelled'
        ELSE 'status_changed'
      END,
      COALESCE(NEW.completed_by, NEW.on_site_by, NEW.on_route_by, NEW.acknowledged_by),
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

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('astreinte-reports', 'astreinte-reports', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMENT ON COLUMN astreinte_tickets.intervention_outcome IS
  'Issue de l''intervention saisie par l''agent à la clôture.';
COMMENT ON COLUMN astreinte_tickets.intervention_destination IS
  'Destination de l''animal après intervention.';
COMMENT ON COLUMN astreinte_tickets.intervention_comments IS
  'Observations terrain libres rédigées par l''agent.';
COMMENT ON COLUMN astreinte_tickets.report_pdf_path IS
  'Chemin Storage du PDF compte-rendu (bucket astreinte-reports).';
