-- Add retirement_basket flag to animals
-- An animal can be in "retirement basket" while in any status
-- This indicates an animal that will stay permanently at the shelter (no adoption planned)
ALTER TABLE animals ADD COLUMN IF NOT EXISTS retirement_basket BOOLEAN NOT NULL DEFAULT false;
