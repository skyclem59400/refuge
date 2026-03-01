-- Fix 1: scope the unique constraint on documents.numero to establishment_id
-- The old constraint was global, but numbering is per-establishment,
-- so two establishments could generate the same numero and conflict.

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_numero_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_establishment_numero_key'
  ) THEN
    ALTER TABLE documents ADD CONSTRAINT documents_establishment_numero_key
      UNIQUE (establishment_id, numero);
  END IF;
END $$;

-- Fix 2: fix off-by-one in SUBSTRING that extracted the '-' separator,
-- producing values like '-010' instead of '010', causing INT cast errors.
-- Now uses a regex to extract trailing digits, which is much more robust.

CREATE OR REPLACE FUNCTION get_next_document_number(doc_type TEXT, est_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  year_str TEXT;
  next_num INT;
BEGIN
  prefix := CASE doc_type
    WHEN 'facture' THEN 'F'
    WHEN 'avoir' THEN 'A'
    ELSE 'D'
  END;
  year_str := to_char(now(), 'YYYY');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(numero FROM '(\d+)$') AS INT)
  ), 0) + 1
  INTO next_num
  FROM documents
  WHERE type = doc_type
    AND numero LIKE prefix || '-' || year_str || '-%'
    AND (est_id IS NULL OR establishment_id = est_id);

  RETURN prefix || '-' || year_str || '-' || LPAD(next_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;
