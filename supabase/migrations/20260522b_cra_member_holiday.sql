-- ============================================================
-- Optimus — CRA : horaires jours fériés par collaborateur
-- ============================================================
-- Certains collaborateurs viennent nourrir les animaux les jours fériés.
-- Ces 4 colonnes définissent leurs horaires sur TOUS les jours fériés.
-- Si NULL = le membre ne travaille pas les fériés (défaut, 0h).
-- Mary peut surcharger un jour férié spécifique via cra_entries comme avant.

ALTER TABLE establishment_members
  ADD COLUMN IF NOT EXISTS holiday_start_am TIME,
  ADD COLUMN IF NOT EXISTS holiday_end_am   TIME,
  ADD COLUMN IF NOT EXISTS holiday_start_pm TIME,
  ADD COLUMN IF NOT EXISTS holiday_end_pm   TIME;

ALTER TABLE establishment_members
  DROP CONSTRAINT IF EXISTS em_holiday_max_17;
ALTER TABLE establishment_members
  ADD CONSTRAINT em_holiday_max_17 CHECK (
    (holiday_end_am IS NULL OR holiday_end_am <= '17:00'::time)
    AND (holiday_end_pm IS NULL OR holiday_end_pm <= '17:00'::time)
  );

ALTER TABLE establishment_members
  DROP CONSTRAINT IF EXISTS em_holiday_ordered;
ALTER TABLE establishment_members
  ADD CONSTRAINT em_holiday_ordered CHECK (
    (holiday_start_am IS NULL OR holiday_end_am IS NULL OR holiday_end_am > holiday_start_am)
    AND (holiday_start_pm IS NULL OR holiday_end_pm IS NULL OR holiday_end_pm > holiday_start_pm)
    AND (holiday_end_am IS NULL OR holiday_start_pm IS NULL OR holiday_start_pm >= holiday_end_am)
  );
