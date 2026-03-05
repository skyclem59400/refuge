-- Update RLS policies on staff_schedule and appointments to use manage_planning permission
-- This migration should be run AFTER 20260304_staff_schedule.sql, 20260304_appointments.sql, and 20260305_add_manage_planning.sql

-- Update staff_schedule RLS policies
DROP POLICY IF EXISTS "staff_schedule_select" ON staff_schedule;
CREATE POLICY "staff_schedule_select" ON staff_schedule FOR SELECT USING (
  establishment_id IN (
    SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "staff_schedule_insert" ON staff_schedule;
CREATE POLICY "staff_schedule_insert" ON staff_schedule FOR INSERT WITH CHECK (
  user_has_permission(establishment_id, 'manage_planning')
);

DROP POLICY IF EXISTS "staff_schedule_update" ON staff_schedule;
CREATE POLICY "staff_schedule_update" ON staff_schedule FOR UPDATE USING (
  user_has_permission(establishment_id, 'manage_planning')
);

DROP POLICY IF EXISTS "staff_schedule_delete" ON staff_schedule;
CREATE POLICY "staff_schedule_delete" ON staff_schedule FOR DELETE USING (
  user_has_permission(establishment_id, 'manage_planning')
);

-- Update appointments RLS policies
DROP POLICY IF EXISTS "appointments_select" ON appointments;
CREATE POLICY "appointments_select" ON appointments FOR SELECT USING (
  establishment_id IN (
    SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "appointments_insert" ON appointments;
CREATE POLICY "appointments_insert" ON appointments FOR INSERT WITH CHECK (
  user_has_permission(establishment_id, 'manage_planning')
);

DROP POLICY IF EXISTS "appointments_update" ON appointments;
CREATE POLICY "appointments_update" ON appointments FOR UPDATE USING (
  user_has_permission(establishment_id, 'manage_planning')
);

DROP POLICY IF EXISTS "appointments_delete" ON appointments;
CREATE POLICY "appointments_delete" ON appointments FOR DELETE USING (
  user_has_permission(establishment_id, 'manage_planning')
);
