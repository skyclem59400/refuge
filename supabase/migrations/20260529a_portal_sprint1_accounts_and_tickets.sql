-- ============================================
-- Portal Sprint 1 : Comptes utilisateurs + tickets unifiés
-- ============================================
-- Objectif : transformer les 3 formulaires publics actuels en tickets
-- attachés à un compte utilisateur. Modélisation inspirée d'astreinte_*.
--
-- Tables touchées :
--   - portal_profiles (NEW) : 1-1 auth.users, infos compte public
--   - adoption_inquiries, volunteer_applications, abuse_reports :
--       + user_id NOT NULL, ticket_number UNIQUE auto-numéroté
--   - portal_ticket_events (NEW) : timeline polymorphe
--   - Vue portal_user_tickets : UNION pour le dashboard user
--
-- NOTE : Migration appliquée directement sur le projet Supabase (id
-- zzevrtrgtgnlxxuwbnge, version 20260529102540). Ce fichier sert de miroir
-- en source pour le suivi.
-- ============================================

-- ============================================
-- 1. portal_profiles
-- ============================================
CREATE TABLE IF NOT EXISTS portal_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  consent_marketing BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_profiles_updated ON portal_profiles(updated_at DESC);

-- ============================================
-- 2. Helper : is_staff_member
-- ============================================
CREATE OR REPLACE FUNCTION is_staff_member(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM establishment_members
    WHERE user_id = check_user_id
  );
$$;

-- ============================================
-- 3. Séquences + colonnes user_id / ticket_number
-- ============================================
CREATE SEQUENCE IF NOT EXISTS adoption_ticket_seq START 1;
CREATE SEQUENCE IF NOT EXISTS volunteer_ticket_seq START 1;
CREATE SEQUENCE IF NOT EXISTS abuse_report_ticket_seq START 1;

ALTER TABLE adoption_inquiries
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ticket_number TEXT UNIQUE;

ALTER TABLE volunteer_applications
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ticket_number TEXT UNIQUE;

ALTER TABLE abuse_reports
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ticket_number TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_adoption_inquiries_user ON adoption_inquiries(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_volunteer_applications_user ON volunteer_applications(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_abuse_reports_user ON abuse_reports(user_id) WHERE user_id IS NOT NULL;

-- ============================================
-- 4. Auto-numérotation ticket_number (triggers BEFORE INSERT)
-- ============================================
CREATE OR REPLACE FUNCTION assign_adoption_ticket_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := 'ADO-' || to_char(NOW(), 'YYYY') || '-' || LPAD(nextval('adoption_ticket_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION assign_volunteer_ticket_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := 'BEN-' || to_char(NOW(), 'YYYY') || '-' || LPAD(nextval('volunteer_ticket_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION assign_abuse_report_ticket_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := 'SIG-' || to_char(NOW(), 'YYYY') || '-' || LPAD(nextval('abuse_report_ticket_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_adoption_ticket_number ON adoption_inquiries;
CREATE TRIGGER trg_adoption_ticket_number
  BEFORE INSERT ON adoption_inquiries
  FOR EACH ROW EXECUTE FUNCTION assign_adoption_ticket_number();

DROP TRIGGER IF EXISTS trg_volunteer_ticket_number ON volunteer_applications;
CREATE TRIGGER trg_volunteer_ticket_number
  BEFORE INSERT ON volunteer_applications
  FOR EACH ROW EXECUTE FUNCTION assign_volunteer_ticket_number();

DROP TRIGGER IF EXISTS trg_abuse_report_ticket_number ON abuse_reports;
CREATE TRIGGER trg_abuse_report_ticket_number
  BEFORE INSERT ON abuse_reports
  FOR EACH ROW EXECUTE FUNCTION assign_abuse_report_ticket_number();

ALTER TABLE adoption_inquiries ALTER COLUMN ticket_number SET NOT NULL;
ALTER TABLE volunteer_applications ALTER COLUMN ticket_number SET NOT NULL;
ALTER TABLE abuse_reports ALTER COLUMN ticket_number SET NOT NULL;

-- ============================================
-- 5. portal_ticket_events (timeline polymorphe)
-- ============================================
CREATE TABLE IF NOT EXISTS portal_ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_type TEXT NOT NULL CHECK (ticket_type IN ('adoption', 'volunteer', 'abuse_report')),
  ticket_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'status_change', 'comment_user', 'message_staff', 'attachment_added'
  )),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_role TEXT NOT NULL DEFAULT 'system' CHECK (performed_by_role IN ('user', 'staff', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_ticket_events_ticket ON portal_ticket_events(ticket_type, ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_ticket_events_performed_by ON portal_ticket_events(performed_by) WHERE performed_by IS NOT NULL;

-- ============================================
-- 6. Trigger : auto-emit 'created' event à l'insert d'un ticket
-- ============================================
CREATE OR REPLACE FUNCTION emit_ticket_created_event()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_type TEXT;
BEGIN
  v_type := CASE TG_TABLE_NAME
    WHEN 'adoption_inquiries' THEN 'adoption'
    WHEN 'volunteer_applications' THEN 'volunteer'
    WHEN 'abuse_reports' THEN 'abuse_report'
  END;

  INSERT INTO portal_ticket_events (ticket_type, ticket_id, event_type, payload, performed_by, performed_by_role)
  VALUES (
    v_type,
    NEW.id,
    'created',
    jsonb_build_object('ticket_number', NEW.ticket_number, 'status', NEW.status),
    NEW.user_id,
    CASE WHEN NEW.user_id IS NULL THEN 'system' ELSE 'user' END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_adoption_created_event ON adoption_inquiries;
CREATE TRIGGER trg_adoption_created_event
  AFTER INSERT ON adoption_inquiries
  FOR EACH ROW EXECUTE FUNCTION emit_ticket_created_event();

DROP TRIGGER IF EXISTS trg_volunteer_created_event ON volunteer_applications;
CREATE TRIGGER trg_volunteer_created_event
  AFTER INSERT ON volunteer_applications
  FOR EACH ROW EXECUTE FUNCTION emit_ticket_created_event();

DROP TRIGGER IF EXISTS trg_abuse_report_created_event ON abuse_reports;
CREATE TRIGGER trg_abuse_report_created_event
  AFTER INSERT ON abuse_reports
  FOR EACH ROW EXECUTE FUNCTION emit_ticket_created_event();

-- ============================================
-- 7. Trigger : auto-emit 'status_change' event à l'update du status
-- ============================================
CREATE OR REPLACE FUNCTION emit_ticket_status_change_event()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_type TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_type := CASE TG_TABLE_NAME
    WHEN 'adoption_inquiries' THEN 'adoption'
    WHEN 'volunteer_applications' THEN 'volunteer'
    WHEN 'abuse_reports' THEN 'abuse_report'
  END;

  INSERT INTO portal_ticket_events (ticket_type, ticket_id, event_type, payload, performed_by, performed_by_role)
  VALUES (
    v_type,
    NEW.id,
    'status_change',
    jsonb_build_object('from', OLD.status, 'to', NEW.status),
    auth.uid(),
    CASE
      WHEN auth.uid() IS NULL THEN 'system'
      WHEN is_staff_member(auth.uid()) THEN 'staff'
      ELSE 'user'
    END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_adoption_status_change ON adoption_inquiries;
CREATE TRIGGER trg_adoption_status_change
  AFTER UPDATE OF status ON adoption_inquiries
  FOR EACH ROW EXECUTE FUNCTION emit_ticket_status_change_event();

DROP TRIGGER IF EXISTS trg_volunteer_status_change ON volunteer_applications;
CREATE TRIGGER trg_volunteer_status_change
  AFTER UPDATE OF status ON volunteer_applications
  FOR EACH ROW EXECUTE FUNCTION emit_ticket_status_change_event();

DROP TRIGGER IF EXISTS trg_abuse_report_status_change ON abuse_reports;
CREATE TRIGGER trg_abuse_report_status_change
  AFTER UPDATE OF status ON abuse_reports
  FOR EACH ROW EXECUTE FUNCTION emit_ticket_status_change_event();

-- ============================================
-- 8. Vue portal_user_tickets (UNION pour dashboard user)
-- ============================================
CREATE OR REPLACE VIEW portal_user_tickets AS
  SELECT
    'adoption'::text AS ticket_type,
    id AS ticket_id,
    user_id,
    ticket_number,
    status,
    first_name,
    last_name,
    email,
    created_at,
    updated_at
  FROM adoption_inquiries
  WHERE user_id IS NOT NULL
  UNION ALL
  SELECT
    'volunteer'::text AS ticket_type,
    id AS ticket_id,
    user_id,
    ticket_number,
    status,
    first_name,
    last_name,
    email,
    created_at,
    updated_at
  FROM volunteer_applications
  WHERE user_id IS NOT NULL
  UNION ALL
  SELECT
    'abuse_report'::text AS ticket_type,
    id AS ticket_id,
    user_id,
    ticket_number,
    status,
    reporter_first_name AS first_name,
    reporter_last_name AS last_name,
    reporter_email AS email,
    created_at,
    updated_at
  FROM abuse_reports
  WHERE user_id IS NOT NULL;

-- ============================================
-- 9. RLS portal_profiles
-- ============================================
ALTER TABLE portal_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_profiles_self_select ON portal_profiles;
CREATE POLICY portal_profiles_self_select ON portal_profiles
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_staff_member(auth.uid())
  );

DROP POLICY IF EXISTS portal_profiles_self_insert ON portal_profiles;
CREATE POLICY portal_profiles_self_insert ON portal_profiles
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND NOT is_staff_member(auth.uid())
  );

DROP POLICY IF EXISTS portal_profiles_self_update ON portal_profiles;
CREATE POLICY portal_profiles_self_update ON portal_profiles
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================
-- 10. RLS sur les 3 tables tickets (côté user portail)
-- ============================================
DROP POLICY IF EXISTS portal_adoption_self_select ON adoption_inquiries;
CREATE POLICY portal_adoption_self_select ON adoption_inquiries
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS portal_adoption_self_insert ON adoption_inquiries;
CREATE POLICY portal_adoption_self_insert ON adoption_inquiries
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND NOT is_staff_member(auth.uid())
  );

DROP POLICY IF EXISTS portal_volunteer_self_select ON volunteer_applications;
CREATE POLICY portal_volunteer_self_select ON volunteer_applications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS portal_volunteer_self_insert ON volunteer_applications;
CREATE POLICY portal_volunteer_self_insert ON volunteer_applications
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND NOT is_staff_member(auth.uid())
  );

DROP POLICY IF EXISTS portal_abuse_self_select ON abuse_reports;
CREATE POLICY portal_abuse_self_select ON abuse_reports
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS portal_abuse_self_insert ON abuse_reports;
CREATE POLICY portal_abuse_self_insert ON abuse_reports
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND NOT is_staff_member(auth.uid())
  );

-- ============================================
-- 11. RLS portal_ticket_events
-- ============================================
ALTER TABLE portal_ticket_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_events_select ON portal_ticket_events;
CREATE POLICY portal_events_select ON portal_ticket_events
  FOR SELECT USING (
    is_staff_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM adoption_inquiries ai
      WHERE ai.id = portal_ticket_events.ticket_id
        AND ai.user_id = auth.uid()
        AND portal_ticket_events.ticket_type = 'adoption'
    )
    OR EXISTS (
      SELECT 1 FROM volunteer_applications va
      WHERE va.id = portal_ticket_events.ticket_id
        AND va.user_id = auth.uid()
        AND portal_ticket_events.ticket_type = 'volunteer'
    )
    OR EXISTS (
      SELECT 1 FROM abuse_reports ar
      WHERE ar.id = portal_ticket_events.ticket_id
        AND ar.user_id = auth.uid()
        AND portal_ticket_events.ticket_type = 'abuse_report'
    )
  );

DROP POLICY IF EXISTS portal_events_insert ON portal_ticket_events;
CREATE POLICY portal_events_insert ON portal_ticket_events
  FOR INSERT WITH CHECK (
    performed_by = auth.uid()
    AND event_type IN ('comment_user', 'message_staff')
  );

-- ============================================
-- 12. updated_at trigger portal_profiles
-- ============================================
CREATE OR REPLACE FUNCTION portal_profiles_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_profiles_updated_at ON portal_profiles;
CREATE TRIGGER trg_portal_profiles_updated_at
  BEFORE UPDATE ON portal_profiles
  FOR EACH ROW EXECUTE FUNCTION portal_profiles_set_updated_at();
