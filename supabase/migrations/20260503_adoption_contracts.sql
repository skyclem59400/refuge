-- ============================================================
-- Optimus v2.3 — Adoption contracts with electronic signature
-- ============================================================
-- Convention d'adoption (cession définitive d'un animal à un adoptant).
-- Calque sur foster_contracts. Numéro CA-YYYY-NNN.
-- Migration appliquée sur Supabase prod le 2026-05-03.
-- ============================================================

CREATE TABLE IF NOT EXISTS adoption_contracts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id            UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  animal_id                   UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  adopter_client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  contract_number             TEXT NOT NULL,
  adoption_date               DATE NOT NULL,
  adoption_fee                NUMERIC(10,2) NOT NULL DEFAULT 0,
  status                      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','cancelled')),
  sterilization_required      BOOLEAN NOT NULL DEFAULT true,
  sterilization_deadline      DATE,
  sterilization_deposit       NUMERIC(10,2),
  visit_right_clause          BOOLEAN NOT NULL DEFAULT true,
  non_resale_clause           BOOLEAN NOT NULL DEFAULT true,
  shelter_return_clause       BOOLEAN NOT NULL DEFAULT true,
  household_acknowledgment    BOOLEAN NOT NULL DEFAULT false,
  special_conditions          TEXT,
  signed_at_location          TEXT,
  signed_at                   DATE,
  notes                       TEXT,
  pdf_url                     TEXT,
  documenso_document_id       INTEGER,
  documenso_recipient_id      INTEGER,
  documenso_signing_url       TEXT,
  signature_status            TEXT NOT NULL DEFAULT 'not_sent'
                              CHECK (signature_status IN ('not_sent','pending','viewed','signed','rejected','failed')),
  signature_sent_at           TIMESTAMPTZ,
  signature_viewed_at         TIMESTAMPTZ,
  signed_at_via_documenso     TIMESTAMPTZ,
  signed_pdf_url              TEXT,
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, contract_number)
);

CREATE INDEX IF NOT EXISTS idx_adoption_contracts_establishment ON adoption_contracts(establishment_id);
CREATE INDEX IF NOT EXISTS idx_adoption_contracts_animal       ON adoption_contracts(animal_id);
CREATE INDEX IF NOT EXISTS idx_adoption_contracts_adopter      ON adoption_contracts(adopter_client_id);
CREATE INDEX IF NOT EXISTS idx_adoption_contracts_status       ON adoption_contracts(status);
CREATE INDEX IF NOT EXISTS idx_adoption_contracts_documenso_doc ON adoption_contracts(documenso_document_id);
CREATE INDEX IF NOT EXISTS idx_adoption_contracts_signature_status ON adoption_contracts(signature_status);

CREATE OR REPLACE TRIGGER tr_adoption_contracts_updated
  BEFORE UPDATE ON adoption_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION get_next_adoption_contract_number(est_id UUID)
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_seq INT;
  number_str TEXT;
BEGIN
  current_year := to_char(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(contract_number FROM 'CA-' || current_year || '-(\d+)$') AS INTEGER)
  ), 0) + 1 INTO next_seq
  FROM adoption_contracts
  WHERE establishment_id = est_id AND contract_number LIKE 'CA-' || current_year || '-%';
  number_str := 'CA-' || current_year || '-' || LPAD(next_seq::TEXT, 3, '0');
  RETURN number_str;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE adoption_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "adoption_contracts_select" ON adoption_contracts;
DROP POLICY IF EXISTS "adoption_contracts_insert" ON adoption_contracts;
DROP POLICY IF EXISTS "adoption_contracts_update" ON adoption_contracts;
DROP POLICY IF EXISTS "adoption_contracts_delete" ON adoption_contracts;

CREATE POLICY "adoption_contracts_select" ON adoption_contracts FOR SELECT USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "adoption_contracts_insert" ON adoption_contracts FOR INSERT WITH CHECK (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "adoption_contracts_update" ON adoption_contracts FOR UPDATE USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "adoption_contracts_delete" ON adoption_contracts FOR DELETE USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('adoption-contracts', 'adoption-contracts', true, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
