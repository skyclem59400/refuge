-- Add reserved flag to animals (independent of status)
-- An animal can be "reserved" while in any status (shelter, foster, pound, etc.)
ALTER TABLE animals ADD COLUMN IF NOT EXISTS reserved BOOLEAN NOT NULL DEFAULT false;
