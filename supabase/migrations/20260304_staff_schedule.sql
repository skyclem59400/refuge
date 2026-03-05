-- ============================================================
-- SDA Refuge — Staff Schedule/Planning
-- Migration: 20260304_staff_schedule
-- Planification des horaires de présence du personnel par les managers
-- A executer dans Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. Table: staff_schedule
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_schedule (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  notes             TEXT,
  created_by        UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date, start_time)
);

-- ============================================================
-- 2. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_staff_schedule_establishment_date
  ON staff_schedule(establishment_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_staff_schedule_user_date
  ON staff_schedule(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_staff_schedule_date_range
  ON staff_schedule(establishment_id, date);

-- ============================================================
-- 3. Trigger updated_at
-- ============================================================
CREATE TRIGGER tr_staff_schedule_updated
  BEFORE UPDATE ON staff_schedule
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. RLS policies
-- ============================================================
ALTER TABLE staff_schedule ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Only managers/admins can view schedules
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_schedule_select') THEN
    CREATE POLICY "staff_schedule_select" ON staff_schedule FOR SELECT USING (
      user_has_permission(establishment_id, 'manage_establishment')
    );
  END IF;

  -- Only managers/admins can create schedules
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_schedule_insert') THEN
    CREATE POLICY "staff_schedule_insert" ON staff_schedule FOR INSERT WITH CHECK (
      user_has_permission(establishment_id, 'manage_establishment')
    );
  END IF;

  -- Only managers/admins can update schedules
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_schedule_update') THEN
    CREATE POLICY "staff_schedule_update" ON staff_schedule FOR UPDATE USING (
      user_has_permission(establishment_id, 'manage_establishment')
    );
  END IF;

  -- Only managers/admins can delete schedules
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_schedule_delete') THEN
    CREATE POLICY "staff_schedule_delete" ON staff_schedule FOR DELETE USING (
      user_has_permission(establishment_id, 'manage_establishment')
    );
  END IF;
END $$;

-- ============================================================
-- DONE! Staff schedule schema ready.
-- ============================================================
