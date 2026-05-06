-- =====================================================================
-- Sectorisation des box : zones et sous-zones (profondeur max 2)
-- =====================================================================

CREATE TABLE IF NOT EXISTS box_zones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  parent_id       UUID REFERENCES box_zones(id) ON DELETE CASCADE,
  description     TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (establishment_id, parent_id, name)
);

CREATE INDEX IF NOT EXISTS idx_box_zones_establishment
  ON box_zones(establishment_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_box_zones_parent
  ON box_zones(parent_id) WHERE parent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION box_zones_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_box_zones_updated_at ON box_zones;
CREATE TRIGGER trg_box_zones_updated_at
  BEFORE UPDATE ON box_zones
  FOR EACH ROW EXECUTE FUNCTION box_zones_set_updated_at();

CREATE OR REPLACE FUNCTION box_zones_check_depth()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  parent_has_parent BOOLEAN;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT (parent_id IS NOT NULL) INTO parent_has_parent
    FROM box_zones WHERE id = NEW.parent_id;
    IF parent_has_parent THEN
      RAISE EXCEPTION 'Une sous-zone ne peut pas elle-même contenir des sous-zones (profondeur max : 2).';
    END IF;
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'Une zone ne peut pas être son propre parent.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_box_zones_check_depth ON box_zones;
CREATE TRIGGER trg_box_zones_check_depth
  BEFORE INSERT OR UPDATE ON box_zones
  FOR EACH ROW EXECUTE FUNCTION box_zones_check_depth();

ALTER TABLE boxes
  ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES box_zones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_boxes_zone ON boxes(zone_id) WHERE zone_id IS NOT NULL;

ALTER TABLE box_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "box_zones_member_read" ON box_zones;
CREATE POLICY "box_zones_member_read" ON box_zones
  FOR SELECT TO authenticated
  USING (establishment_id IN (SELECT id FROM user_establishment_ids()));

DROP POLICY IF EXISTS "box_zones_member_write" ON box_zones;
CREATE POLICY "box_zones_member_write" ON box_zones
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM user_establishment_ids()))
  WITH CHECK (establishment_id IN (SELECT id FROM user_establishment_ids()));

COMMENT ON TABLE box_zones IS
  'Sectorisation des box : zones (Chenil 1) et sous-zones (Box intérieur).';
