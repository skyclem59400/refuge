-- ============================================================
-- Optimus — Récap auto-email à la fin d'un passage véto
-- ============================================================
-- À la dernière validation d'une ligne d'un passage véto, un PDF récap
-- est généré (charte SDA), archivé en storage et envoyé par email à la
-- clinique vétérinaire (config `establishments.vet_recap_email`).
-- Pour SDA Estourmel : destinataire = compta@deltour.vet

ALTER TABLE vet_visits
  ADD COLUMN IF NOT EXISTS recap_sent_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recap_sent_by        UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS recap_sent_to        TEXT,
  ADD COLUMN IF NOT EXISTS recap_storage_path   TEXT,
  ADD COLUMN IF NOT EXISTS recap_email_message_id TEXT;

ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS vet_recap_email TEXT;

UPDATE establishments
SET vet_recap_email = 'compta@deltour.vet'
WHERE id = 'f0a9d4a8-143d-431e-a875-0b2dc1f505ba'
  AND (vet_recap_email IS NULL OR vet_recap_email = '');

INSERT INTO storage.buckets (id, name, public)
VALUES ('vet-visit-recaps', 'vet-visit-recaps', false)
ON CONFLICT (id) DO NOTHING;
