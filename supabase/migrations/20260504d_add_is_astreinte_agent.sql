-- Add is_astreinte_agent flag on establishment_members
-- to filter the assignee dropdown in SDA Astreinte tickets.

ALTER TABLE establishment_members
  ADD COLUMN IF NOT EXISTS is_astreinte_agent BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS establishment_members_astreinte_agent_idx
  ON establishment_members(establishment_id)
  WHERE is_astreinte_agent = TRUE;

COMMENT ON COLUMN establishment_members.is_astreinte_agent IS
  'Flag indiquant si ce membre est un agent d''astreinte assignable aux tickets SDA Astreinte.';
