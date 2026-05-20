-- ============================================================
-- Optimus — Module CRA : ajout d'une etape validation admin
-- ============================================================
-- Workflow etendu :
--   draft → submitted → validated_by_member → validated_by_admin → sent
-- L'envoi au comptable n'est possible qu'apres double validation
-- (collaborateur + admin Clement/Celine).

ALTER TABLE cra_monthly_status DROP CONSTRAINT IF EXISTS cra_monthly_status_status_check;
ALTER TABLE cra_monthly_status ADD CONSTRAINT cra_monthly_status_status_check
  CHECK (status IN ('draft', 'submitted', 'validated_by_member', 'validated_by_admin', 'change_requested', 'sent'));

ALTER TABLE cra_monthly_status
  ADD COLUMN IF NOT EXISTS admin_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_validated_by UUID REFERENCES auth.users(id);
