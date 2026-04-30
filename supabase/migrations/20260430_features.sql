-- =====================================================================
-- Migration 2026-04-30 — Avril 2026 features
-- - Nouveaux types d'actes santé : identification, radio, blood_test
-- - Permission manage_veterinarians (groupes)
-- - Pièces jointes animaux (table + bucket storage)
-- - Saisies de règlement (table payment_entries)
-- =====================================================================

-- =========================================
-- 1) Nouveaux types d'actes santé
-- =========================================

ALTER TABLE animal_health_records
  DROP CONSTRAINT IF EXISTS animal_health_records_type_check;

ALTER TABLE animal_health_records
  ADD CONSTRAINT animal_health_records_type_check CHECK (type IN (
    'vaccination', 'sterilization', 'antiparasitic', 'consultation',
    'surgery', 'medication', 'behavioral_assessment',
    'identification', 'radio', 'blood_test'
  ));

ALTER TABLE health_protocol_steps
  DROP CONSTRAINT IF EXISTS health_protocol_steps_health_record_type_check;

ALTER TABLE health_protocol_steps
  ADD CONSTRAINT health_protocol_steps_health_record_type_check CHECK (health_record_type IN (
    'vaccination', 'sterilization', 'antiparasitic', 'consultation',
    'surgery', 'medication', 'behavioral_assessment',
    'identification', 'radio', 'blood_test'
  ));

-- =========================================
-- 2) Permission manage_veterinarians
-- =========================================

ALTER TABLE permission_groups
  ADD COLUMN IF NOT EXISTS manage_veterinarians BOOLEAN NOT NULL DEFAULT false;

-- Active la permission par défaut sur les groupes Administrateur (système)
UPDATE permission_groups
SET manage_veterinarians = true
WHERE is_system = true AND name = 'Administrateur';

-- =========================================
-- 3) Pièces jointes animaux
-- =========================================

CREATE TABLE IF NOT EXISTS animal_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id       UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  file_path       TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  mime_type       TEXT,
  size_bytes      BIGINT,
  label           TEXT,
  uploaded_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_animal_attachments_animal ON animal_attachments(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_attachments_establishment ON animal_attachments(establishment_id);

ALTER TABLE animal_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS animal_attachments_select ON animal_attachments;
CREATE POLICY animal_attachments_select ON animal_attachments FOR SELECT
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS animal_attachments_insert ON animal_attachments;
CREATE POLICY animal_attachments_insert ON animal_attachments FOR INSERT
  WITH CHECK (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS animal_attachments_update ON animal_attachments;
CREATE POLICY animal_attachments_update ON animal_attachments FOR UPDATE
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS animal_attachments_delete ON animal_attachments;
CREATE POLICY animal_attachments_delete ON animal_attachments FOR DELETE
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

-- Bucket Supabase Storage (created via storage admin script)
INSERT INTO storage.buckets (id, name, public)
VALUES ('animal-documents', 'animal-documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "animal_documents_authenticated_read" ON storage.objects;
CREATE POLICY "animal_documents_authenticated_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'animal-documents');

DROP POLICY IF EXISTS "animal_documents_authenticated_upload" ON storage.objects;
CREATE POLICY "animal_documents_authenticated_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'animal-documents' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "animal_documents_authenticated_delete" ON storage.objects;
CREATE POLICY "animal_documents_authenticated_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'animal-documents' AND auth.role() = 'authenticated');

-- =========================================
-- 4) Saisies de règlement (payment_entries)
-- =========================================

CREATE TABLE IF NOT EXISTS payment_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id    UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  amount              NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  method              TEXT NOT NULL CHECK (method IN (
                        'cheque', 'virement', 'especes', 'cb', 'prelevement', 'helloasso', 'autre'
                      )),
  payment_type        TEXT NOT NULL CHECK (payment_type IN (
                        'pension', 'adoption', 'don', 'fourriere', 'autre'
                      )),
  installment         TEXT NOT NULL DEFAULT 'solde' CHECK (installment IN ('acompte', 'solde', 'total')),
  payer_name          TEXT,
  payer_phone         TEXT,
  payer_email         TEXT,
  reference           TEXT,           -- numéro de chèque, référence virement, etc.
  related_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  related_donation_id UUID REFERENCES donations(id) ON DELETE SET NULL,
  related_animal_id   UUID REFERENCES animals(id) ON DELETE SET NULL,
  related_client_id   UUID REFERENCES clients(id) ON DELETE SET NULL,
  notes               TEXT,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_entries_establishment ON payment_entries(establishment_id);
CREATE INDEX IF NOT EXISTS idx_payment_entries_date ON payment_entries(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payment_entries_document ON payment_entries(related_document_id);
CREATE INDEX IF NOT EXISTS idx_payment_entries_donation ON payment_entries(related_donation_id);
CREATE INDEX IF NOT EXISTS idx_payment_entries_animal ON payment_entries(related_animal_id);

ALTER TABLE payment_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_entries_select ON payment_entries;
CREATE POLICY payment_entries_select ON payment_entries FOR SELECT
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS payment_entries_insert ON payment_entries;
CREATE POLICY payment_entries_insert ON payment_entries FOR INSERT
  WITH CHECK (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS payment_entries_update ON payment_entries;
CREATE POLICY payment_entries_update ON payment_entries FOR UPDATE
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS payment_entries_delete ON payment_entries;
CREATE POLICY payment_entries_delete ON payment_entries FOR DELETE
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION update_payment_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_entries_updated_at ON payment_entries;
CREATE TRIGGER payment_entries_updated_at
  BEFORE UPDATE ON payment_entries
  FOR EACH ROW EXECUTE FUNCTION update_payment_entries_updated_at();
