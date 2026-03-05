-- Add assigned_user_id to appointments table
-- Allows associating a staff member who will handle the appointment

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for quick lookups by assigned user
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_user
  ON appointments(assigned_user_id);

COMMENT ON COLUMN appointments.assigned_user_id IS 'Staff member assigned to handle this appointment';
