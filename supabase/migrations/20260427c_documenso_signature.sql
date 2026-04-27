-- ============================================================
-- Optimus v2.2 — Documenso electronic signature integration
-- Date: 2026-04-27 (c)
-- ============================================================
--
-- Adds signature workflow fields to foster_contracts:
--   - documenso_document_id      INT  : doc id in Documenso
--   - documenso_recipient_id     INT  : recipient (FA) id in Documenso
--   - documenso_signing_url      TEXT : signing URL (if needed manually)
--   - signature_status           TEXT : not_sent | pending | viewed | signed | rejected | failed
--   - signature_sent_at          TIMESTAMPTZ
--   - signature_viewed_at        TIMESTAMPTZ
--   - signed_at_via_documenso    TIMESTAMPTZ
--   - signed_pdf_url             TEXT : URL of signed PDF in storage
--
-- Idempotent: safe to re-run.
-- ============================================================

ALTER TABLE foster_contracts
  ADD COLUMN IF NOT EXISTS documenso_document_id   INTEGER,
  ADD COLUMN IF NOT EXISTS documenso_recipient_id  INTEGER,
  ADD COLUMN IF NOT EXISTS documenso_signing_url   TEXT,
  ADD COLUMN IF NOT EXISTS signature_status        TEXT NOT NULL DEFAULT 'not_sent'
    CHECK (signature_status IN ('not_sent', 'pending', 'viewed', 'signed', 'rejected', 'failed')),
  ADD COLUMN IF NOT EXISTS signature_sent_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_viewed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_at_via_documenso TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_pdf_url          TEXT;

CREATE INDEX IF NOT EXISTS idx_foster_contracts_documenso_doc ON foster_contracts(documenso_document_id);
CREATE INDEX IF NOT EXISTS idx_foster_contracts_signature_status ON foster_contracts(signature_status);
