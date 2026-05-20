-- ============================================================
-- Procedure judiciaire — extension : lieu de recuperation,
-- dates importantes (audience, decision, delai d'appel), avocat,
-- documents de requisition uploades.
-- ============================================================

ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS judicial_pickup_location TEXT,
  ADD COLUMN IF NOT EXISTS judicial_hearing_date DATE,
  ADD COLUMN IF NOT EXISTS judicial_decision_date DATE,
  ADD COLUMN IF NOT EXISTS judicial_appeal_deadline DATE,
  ADD COLUMN IF NOT EXISTS judicial_lawyer_name TEXT,
  ADD COLUMN IF NOT EXISTS judicial_lawyer_contact TEXT;

COMMENT ON COLUMN animals.judicial_pickup_location IS 'Lieu de saisie / recuperation de l animal (adresse, ville).';
COMMENT ON COLUMN animals.judicial_hearing_date IS 'Date de l audience principale.';
COMMENT ON COLUMN animals.judicial_decision_date IS 'Date du jugement / decision.';
COMMENT ON COLUMN animals.judicial_appeal_deadline IS 'Date limite pour faire appel.';
COMMENT ON COLUMN animals.judicial_lawyer_name IS 'Nom du representant legal/avocat assigne au dossier.';

CREATE TABLE IF NOT EXISTS judicial_attachments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  animal_id         UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL DEFAULT 'other',
  storage_path      TEXT NOT NULL,
  file_name         TEXT,
  mime_type         TEXT,
  size_bytes        BIGINT,
  document_date     DATE,
  notes             TEXT,
  uploaded_by       UUID REFERENCES establishment_members(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE judicial_attachments
  DROP CONSTRAINT IF EXISTS judicial_attachments_kind_check;
ALTER TABLE judicial_attachments
  ADD CONSTRAINT judicial_attachments_kind_check
    CHECK (kind IN (
      'seizure_pv',          -- proces-verbal de saisie
      'requisition_order',   -- ordonnance / requisition
      'court_decision',      -- jugement
      'vet_report',          -- rapport veterinaire judiciaire
      'photo_evidence',      -- photos prises lors de la saisie
      'invoice',             -- facture liee au dossier
      'other'
    ));

CREATE INDEX IF NOT EXISTS idx_judicial_attachments_animal ON judicial_attachments(animal_id);
CREATE INDEX IF NOT EXISTS idx_judicial_attachments_establishment ON judicial_attachments(establishment_id);
CREATE INDEX IF NOT EXISTS idx_judicial_attachments_date ON judicial_attachments(document_date DESC);

ALTER TABLE judicial_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS judicial_attachments_select ON judicial_attachments;
CREATE POLICY judicial_attachments_select ON judicial_attachments
  FOR SELECT USING (establishment_id IN (SELECT user_establishment_ids()));

DROP POLICY IF EXISTS judicial_attachments_modify ON judicial_attachments;
CREATE POLICY judicial_attachments_modify ON judicial_attachments
  FOR ALL USING (establishment_id IN (SELECT user_establishment_ids()))
  WITH CHECK (establishment_id IN (SELECT user_establishment_ids()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'judicial-documents',
  'judicial-documents',
  false,
  20971520,  -- 20 MB (PVs longs, scans haute resolution)
  ARRAY['application/pdf','image/png','image/jpeg','image/webp','image/heic','image/tiff']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS judicial_documents_storage_select ON storage.objects;
CREATE POLICY judicial_documents_storage_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'judicial-documents'
    AND (SUBSTRING(name FROM '^([0-9a-f-]{36})/')::uuid IN (SELECT user_establishment_ids()))
  );

DROP POLICY IF EXISTS judicial_documents_storage_insert ON storage.objects;
CREATE POLICY judicial_documents_storage_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'judicial-documents'
    AND (SUBSTRING(name FROM '^([0-9a-f-]{36})/')::uuid IN (SELECT user_establishment_ids()))
  );

DROP POLICY IF EXISTS judicial_documents_storage_delete ON storage.objects;
CREATE POLICY judicial_documents_storage_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'judicial-documents'
    AND (SUBSTRING(name FROM '^([0-9a-f-]{36})/')::uuid IN (SELECT user_establishment_ids()))
  );
