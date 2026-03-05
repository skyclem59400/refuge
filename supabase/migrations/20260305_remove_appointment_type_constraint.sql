-- Remove CHECK constraint on appointments.type to allow custom appointment types
-- This allows users to create custom appointment types beyond 'adoption' and 'veterinary'

-- Drop the existing constraint
ALTER TABLE appointments
DROP CONSTRAINT IF EXISTS appointments_type_check;

-- Add comment to explain that type is free text
COMMENT ON COLUMN appointments.type IS 'Type de rendez-vous (adoption, veterinary, ou type personnalisé)';
