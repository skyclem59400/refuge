-- ============================================================
-- SDA Refuge — Leave Management + Employee Space + Notifications
-- Migration: 20260311_leave_management
-- ============================================================

-- ============================================================
-- 1. Add new permissions to permission_groups
-- ============================================================
ALTER TABLE permission_groups
ADD COLUMN IF NOT EXISTS manage_leaves BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS view_own_leaves BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS manage_payslips BOOLEAN NOT NULL DEFAULT false;

-- Admin gets all new permissions
UPDATE permission_groups
SET manage_leaves = true, view_own_leaves = true, manage_payslips = true
WHERE is_system = true AND name = 'Administrateur';

-- Membre gets view_own_leaves only
UPDATE permission_groups
SET view_own_leaves = true
WHERE is_system = true AND name = 'Membre';

-- ============================================================
-- 2. Update user_has_permission function
-- ============================================================
CREATE OR REPLACE FUNCTION user_has_permission(est_id UUID, perm_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM establishment_members em
    JOIN member_groups mg ON mg.member_id = em.id
    JOIN permission_groups pg ON pg.id = mg.group_id
    WHERE em.user_id = auth.uid()
      AND em.establishment_id = est_id
      AND (
        CASE perm_name
          WHEN 'manage_documents'          THEN pg.manage_documents
          WHEN 'manage_clients'            THEN pg.manage_clients
          WHEN 'manage_establishment'      THEN pg.manage_establishment
          WHEN 'manage_animals'            THEN pg.manage_animals
          WHEN 'view_animals'              THEN pg.view_animals
          WHEN 'manage_health'             THEN pg.manage_health
          WHEN 'manage_movements'          THEN pg.manage_movements
          WHEN 'manage_boxes'              THEN pg.manage_boxes
          WHEN 'manage_posts'              THEN pg.manage_posts
          WHEN 'manage_donations'          THEN pg.manage_donations
          WHEN 'manage_outings'            THEN pg.manage_outings
          WHEN 'manage_outing_assignments' THEN pg.manage_outing_assignments
          WHEN 'manage_adoptions'          THEN pg.manage_adoptions
          WHEN 'manage_planning'           THEN pg.manage_planning
          WHEN 'view_pound'                THEN pg.view_pound
          WHEN 'view_statistics'           THEN pg.view_statistics
          WHEN 'manage_leaves'             THEN pg.manage_leaves
          WHEN 'view_own_leaves'           THEN pg.view_own_leaves
          WHEN 'manage_payslips'           THEN pg.manage_payslips
          ELSE false
        END
      )
  );
$$;

-- ============================================================
-- 3. leave_types table
-- ============================================================
CREATE TABLE leave_types (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  code              TEXT NOT NULL,
  color             TEXT NOT NULL DEFAULT '#6366f1',
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  deducts_balance   BOOLEAN NOT NULL DEFAULT true,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, code)
);

CREATE INDEX idx_leave_types_establishment ON leave_types(establishment_id);

CREATE TRIGGER tr_leave_types_updated
  BEFORE UPDATE ON leave_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. leave_balances table
-- ============================================================
CREATE TABLE leave_balances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  member_id         UUID NOT NULL REFERENCES establishment_members(id) ON DELETE CASCADE,
  leave_type_id     UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year              INTEGER NOT NULL,
  initial_balance   NUMERIC(5,1) NOT NULL DEFAULT 0,
  used              NUMERIC(5,1) NOT NULL DEFAULT 0,
  adjustment        NUMERIC(5,1) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, leave_type_id, year)
);

CREATE INDEX idx_leave_balances_member ON leave_balances(member_id);
CREATE INDEX idx_leave_balances_establishment ON leave_balances(establishment_id);

CREATE TRIGGER tr_leave_balances_updated
  BEFORE UPDATE ON leave_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 5. leave_requests table
-- ============================================================
CREATE TABLE leave_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  member_id         UUID NOT NULL REFERENCES establishment_members(id) ON DELETE CASCADE,
  leave_type_id     UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  half_day_start    BOOLEAN NOT NULL DEFAULT false,
  half_day_end      BOOLEAN NOT NULL DEFAULT false,
  days_count        NUMERIC(4,1) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'refused', 'cancelled')),
  reason            TEXT,
  admin_comment     TEXT,
  reviewed_by       UUID REFERENCES establishment_members(id),
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_leave_requests_member ON leave_requests(member_id);
CREATE INDEX idx_leave_requests_establishment ON leave_requests(establishment_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);

CREATE TRIGGER tr_leave_requests_updated
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 6. payslips table
-- ============================================================
CREATE TABLE payslips (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  member_id         UUID NOT NULL REFERENCES establishment_members(id) ON DELETE CASCADE,
  year              INTEGER NOT NULL,
  month             INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  label             TEXT,
  file_path         TEXT NOT NULL,
  file_url          TEXT NOT NULL,
  file_size         INTEGER,
  uploaded_by       UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, year, month, label)
);

CREATE INDEX idx_payslips_member ON payslips(member_id);
CREATE INDEX idx_payslips_establishment ON payslips(establishment_id);

-- ============================================================
-- 7. notifications table (reusable across app)
-- ============================================================
CREATE TABLE notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL,
  type              TEXT NOT NULL,
  title             TEXT NOT NULL,
  body              TEXT,
  link              TEXT,
  read              BOOLEAN NOT NULL DEFAULT false,
  read_at           TIMESTAMPTZ,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX idx_notifications_establishment ON notifications(establishment_id);

-- ============================================================
-- 8. notification_preferences table
-- ============================================================
CREATE TABLE notification_preferences (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE,
  email_enabled     BOOLEAN NOT NULL DEFAULT true,
  push_enabled      BOOLEAN NOT NULL DEFAULT false,
  push_subscription JSONB,
  leave_email       BOOLEAN NOT NULL DEFAULT true,
  leave_push        BOOLEAN NOT NULL DEFAULT true,
  payslip_email     BOOLEAN NOT NULL DEFAULT true,
  payslip_push      BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_notification_preferences_updated
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 9. RLS Policies
-- ============================================================

-- leave_types
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lt_select" ON leave_types FOR SELECT TO authenticated
USING (
  establishment_id IN (
    SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "lt_insert" ON leave_types FOR INSERT TO authenticated
WITH CHECK (user_has_permission(establishment_id, 'manage_leaves'));

CREATE POLICY "lt_update" ON leave_types FOR UPDATE TO authenticated
USING (user_has_permission(establishment_id, 'manage_leaves'));

CREATE POLICY "lt_delete" ON leave_types FOR DELETE TO authenticated
USING (user_has_permission(establishment_id, 'manage_leaves'));

-- leave_balances
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lb_select" ON leave_balances FOR SELECT TO authenticated
USING (
  member_id IN (SELECT id FROM establishment_members WHERE user_id = auth.uid())
  OR user_has_permission(establishment_id, 'manage_leaves')
);

CREATE POLICY "lb_insert" ON leave_balances FOR INSERT TO authenticated
WITH CHECK (user_has_permission(establishment_id, 'manage_leaves'));

CREATE POLICY "lb_update" ON leave_balances FOR UPDATE TO authenticated
USING (user_has_permission(establishment_id, 'manage_leaves'));

CREATE POLICY "lb_delete" ON leave_balances FOR DELETE TO authenticated
USING (user_has_permission(establishment_id, 'manage_leaves'));

-- leave_requests
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lr_select" ON leave_requests FOR SELECT TO authenticated
USING (
  member_id IN (SELECT id FROM establishment_members WHERE user_id = auth.uid())
  OR user_has_permission(establishment_id, 'manage_leaves')
);

CREATE POLICY "lr_insert" ON leave_requests FOR INSERT TO authenticated
WITH CHECK (
  member_id IN (SELECT id FROM establishment_members WHERE user_id = auth.uid())
);

CREATE POLICY "lr_update" ON leave_requests FOR UPDATE TO authenticated
USING (
  user_has_permission(establishment_id, 'manage_leaves')
  OR (
    member_id IN (SELECT id FROM establishment_members WHERE user_id = auth.uid())
    AND status = 'pending'
  )
);

-- payslips
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_select" ON payslips FOR SELECT TO authenticated
USING (
  member_id IN (SELECT id FROM establishment_members WHERE user_id = auth.uid())
  OR user_has_permission(establishment_id, 'manage_payslips')
);

CREATE POLICY "ps_insert" ON payslips FOR INSERT TO authenticated
WITH CHECK (user_has_permission(establishment_id, 'manage_payslips'));

CREATE POLICY "ps_delete" ON payslips FOR DELETE TO authenticated
USING (user_has_permission(establishment_id, 'manage_payslips'));

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_select" ON notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "notif_update" ON notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "np_select" ON notification_preferences FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "np_insert" ON notification_preferences FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "np_update" ON notification_preferences FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 10. Storage bucket for payslips
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payslips', 'payslips', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "payslips_upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payslips');

CREATE POLICY "payslips_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payslips');

CREATE POLICY "payslips_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payslips');

-- ============================================================
-- 11. Seed default leave types for all existing establishments
-- ============================================================
DO $$
DECLARE
  est_record RECORD;
BEGIN
  FOR est_record IN SELECT id FROM establishments LOOP
    INSERT INTO leave_types (establishment_id, name, code, color, requires_approval, deducts_balance)
    VALUES
      (est_record.id, 'Conges payes', 'cp', '#10b981', true, true),
      (est_record.id, 'RTT', 'rtt', '#3b82f6', true, true),
      (est_record.id, 'Arret maladie', 'maladie', '#ef4444', false, false),
      (est_record.id, 'Conge sans solde', 'sans_solde', '#f59e0b', true, false),
      (est_record.id, 'Formation', 'formation', '#8b5cf6', true, false),
      (est_record.id, 'Conge exceptionnel', 'exceptionnelle', '#ec4899', true, true)
    ON CONFLICT (establishment_id, code) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================
-- DONE! Leave management system ready.
-- ============================================================
