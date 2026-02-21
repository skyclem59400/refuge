-- ============================================================
-- SDA Estormel — Donations & CERFA receipts
-- Migration: 20260221_donations
-- ============================================================

-- ============================================================
-- 1. Donations table
-- ============================================================
CREATE TABLE IF NOT EXISTS donations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,

  -- Donor info
  donor_name        TEXT NOT NULL,
  donor_email       TEXT,
  donor_phone       TEXT,
  donor_address     TEXT,
  donor_postal_code TEXT,
  donor_city        TEXT,

  -- Donation details
  amount            DECIMAL(10,2) NOT NULL,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method    TEXT NOT NULL DEFAULT 'cheque'
                    CHECK (payment_method IN ('cheque', 'virement', 'especes', 'cb', 'prelevement', 'autre')),
  nature            TEXT NOT NULL DEFAULT 'numeraire'
                    CHECK (nature IN ('numeraire', 'nature')),

  -- CERFA receipt
  cerfa_number      TEXT,
  cerfa_generated   BOOLEAN NOT NULL DEFAULT false,
  cerfa_generated_at TIMESTAMPTZ,

  -- Metadata
  notes             TEXT,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Auto-numbering function for CERFA receipts
-- ============================================================
CREATE OR REPLACE FUNCTION get_next_cerfa_number(est_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  current_year TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  next_num INT;
  result TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(cerfa_number, '-', 3) AS INT)
  ), 0) + 1
  INTO next_num
  FROM donations
  WHERE establishment_id = est_id
    AND cerfa_number LIKE 'CERFA-' || current_year || '-%';

  result := 'CERFA-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN result;
END;
$$;

-- ============================================================
-- 3. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_donations_establishment ON donations(establishment_id);
CREATE INDEX IF NOT EXISTS idx_donations_date ON donations(date);
CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_name);
CREATE INDEX IF NOT EXISTS idx_donations_cerfa ON donations(cerfa_number);

-- ============================================================
-- 4. Trigger: updated_at
-- ============================================================
CREATE TRIGGER tr_donations_updated
  BEFORE UPDATE ON donations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 5. RLS policies
-- ============================================================
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "donations_select" ON donations
  FOR SELECT USING (
    establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "donations_insert" ON donations
  FOR INSERT WITH CHECK (
    establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "donations_update" ON donations
  FOR UPDATE USING (
    establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "donations_delete" ON donations
  FOR DELETE USING (
    establishment_id IN (
      SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
    )
  );
