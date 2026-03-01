-- ============================================================
-- SDA Refuge — Owner (superadmin) flag on establishment_members
-- The owner can remove admin rights and delete admin members.
-- ============================================================

ALTER TABLE establishment_members
  ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT false;

-- Set clement.scailteux@gmail.com as owner on all establishments
UPDATE establishment_members
SET is_owner = true
WHERE user_id = '76bbfc56-0d9f-4ca2-ae2c-b8c1e0b11aad';
