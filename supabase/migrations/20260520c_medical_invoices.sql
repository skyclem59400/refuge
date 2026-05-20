-- ============================================================
-- Factures medicales (procedure judiciaire)
-- ============================================================
-- Permet d'uploader la facture PDF/image emise par la clinique pour
-- chaque acte de sante d'un animal en procedure judiciaire.
-- Sert au recap des frais engages (recouvrement tribunal).
-- ============================================================

ALTER TABLE animal_health_records
  ADD COLUMN IF NOT EXISTS invoice_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS invoice_file_name TEXT,
  ADD COLUMN IF NOT EXISTS invoice_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS invoice_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS invoice_uploaded_at TIMESTAMPTZ;

COMMENT ON COLUMN animal_health_records.invoice_storage_path
  IS 'Chemin dans le bucket medical-invoices. Format : <establishment_id>/<animal_id>/<timestamp>_<file>.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medical-invoices',
  'medical-invoices',
  false,
  20971520,  -- 20 MB
  ARRAY['application/pdf','image/png','image/jpeg','image/webp','image/heic','image/tiff']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS medical_invoices_storage_select ON storage.objects;
CREATE POLICY medical_invoices_storage_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'medical-invoices'
    AND (SUBSTRING(name FROM '^([0-9a-f-]{36})/')::uuid IN (SELECT user_establishment_ids()))
  );

DROP POLICY IF EXISTS medical_invoices_storage_insert ON storage.objects;
CREATE POLICY medical_invoices_storage_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'medical-invoices'
    AND (SUBSTRING(name FROM '^([0-9a-f-]{36})/')::uuid IN (SELECT user_establishment_ids()))
  );

DROP POLICY IF EXISTS medical_invoices_storage_delete ON storage.objects;
CREATE POLICY medical_invoices_storage_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'medical-invoices'
    AND (SUBSTRING(name FROM '^([0-9a-f-]{36})/')::uuid IN (SELECT user_establishment_ids()))
  );

CREATE INDEX IF NOT EXISTS idx_animal_health_records_judicial
  ON animal_health_records(animal_id, judicial_procedure)
  WHERE judicial_procedure = true;
