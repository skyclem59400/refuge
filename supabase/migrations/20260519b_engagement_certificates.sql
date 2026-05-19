-- ============================================================
-- Optimus — Certificat d'engagement et de connaissance
-- Date: 2026-05-19 (b)
-- ============================================================
--
-- Implémente le certificat d'engagement obligatoire en France
-- depuis la loi du 30 novembre 2021 (arrêté du 30 mai 2022).
-- Premier document à signer dans le flow d'adoption, avec délai
-- légal de 7 jours calendaires avant la signature du contrat
-- d'adoption final.
--
-- Pattern copié sur foster_contracts (table + RLS + index +
-- numérotation automatique) puis enrichi du workflow Documenso.
--
-- Idempotent : peut être ré-exécuté sans dommage.
-- ============================================================


-- ============================================================
-- 1. Table engagement_certificates
-- ============================================================
CREATE TABLE IF NOT EXISTS engagement_certificates (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id            UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  animal_id                   UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  adopter_client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  certificate_number          TEXT NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                                'draft', 'sent', 'signed', 'expired', 'cancelled'
                              )),
  delivered_at                TIMESTAMPTZ,
  signed_at                   TIMESTAMPTZ,
  -- Délai légal de 7 jours après signature avant l'adoption
  can_finalize_at             DATE,
  -- Documenso integration
  documenso_document_id       INTEGER,
  documenso_recipient_id      INTEGER,
  documenso_signing_url       TEXT,
  signed_pdf_url              TEXT,
  signature_sent_at           TIMESTAMPTZ,
  signature_viewed_at         TIMESTAMPTZ,
  signed_at_via_documenso     TIMESTAMPTZ,
  notes                       TEXT,
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, certificate_number)
);

CREATE INDEX IF NOT EXISTS idx_engagement_certificates_establishment ON engagement_certificates(establishment_id);
CREATE INDEX IF NOT EXISTS idx_engagement_certificates_animal       ON engagement_certificates(animal_id);
CREATE INDEX IF NOT EXISTS idx_engagement_certificates_adopter      ON engagement_certificates(adopter_client_id);
CREATE INDEX IF NOT EXISTS idx_engagement_certificates_status       ON engagement_certificates(status);
CREATE INDEX IF NOT EXISTS idx_engagement_certificates_documenso_doc ON engagement_certificates(documenso_document_id);

CREATE OR REPLACE TRIGGER tr_engagement_certificates_updated
  BEFORE UPDATE ON engagement_certificates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 2. Numérotation automatique : CE-YYYY-NNN par établissement
-- ============================================================
CREATE OR REPLACE FUNCTION get_next_engagement_certificate_number(est_id UUID)
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_seq INT;
  number_str TEXT;
BEGIN
  current_year := to_char(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(certificate_number FROM 'CE-' || current_year || '-(\d+)$') AS INTEGER
    )
  ), 0) + 1
  INTO next_seq
  FROM engagement_certificates
  WHERE establishment_id = est_id
    AND certificate_number LIKE 'CE-' || current_year || '-%';

  number_str := 'CE-' || current_year || '-' || LPAD(next_seq::TEXT, 3, '0');
  RETURN number_str;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 3. RLS scope par établissement
-- ============================================================
ALTER TABLE engagement_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "engagement_certificates_select" ON engagement_certificates;
DROP POLICY IF EXISTS "engagement_certificates_insert" ON engagement_certificates;
DROP POLICY IF EXISTS "engagement_certificates_update" ON engagement_certificates;
DROP POLICY IF EXISTS "engagement_certificates_delete" ON engagement_certificates;

CREATE POLICY "engagement_certificates_select" ON engagement_certificates FOR SELECT USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "engagement_certificates_insert" ON engagement_certificates FOR INSERT WITH CHECK (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "engagement_certificates_update" ON engagement_certificates FOR UPDATE USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "engagement_certificates_delete" ON engagement_certificates FOR DELETE USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);


-- ============================================================
-- 4. Pré-réservation : lien animal <-> futur adoptant
-- ============================================================
ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS pre_reservation_client_id UUID
    REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_animals_pre_reservation_client ON animals(pre_reservation_client_id);


-- ============================================================
-- 5. Storage bucket pour les PDFs signés
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('engagement-certificates', 'engagement-certificates', true)
ON CONFLICT (id) DO NOTHING;
