-- ============================================================
-- Adoption trial period + return-with-refund workflow
-- ============================================================
-- Lorsqu'un animal est adopté il y a une période d'accueil (15 jours par
-- défaut, configurable). Si l'adoptant rend l'animal pendant cette période,
-- on rembourse une partie de l'adoption_fee : refunded = adoption_fee - non_refundable_amount.
-- Le contrat passe en 'trial_returned' et un avenant d'annulation est signé via Documenso.
-- ============================================================

ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS default_trial_period_days INT NOT NULL DEFAULT 15;

ALTER TABLE establishments
  DROP CONSTRAINT IF EXISTS establishments_default_trial_period_days_check;
ALTER TABLE establishments
  ADD CONSTRAINT establishments_default_trial_period_days_check
    CHECK (default_trial_period_days >= 0);

ALTER TABLE adoption_contracts
  ADD COLUMN IF NOT EXISTS trial_period_days INT,
  ADD COLUMN IF NOT EXISTS trial_period_ends_at DATE,
  ADD COLUMN IF NOT EXISTS non_refundable_amount NUMERIC(10,2) DEFAULT 60,
  ADD COLUMN IF NOT EXISTS returned_at DATE,
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS refunded_at DATE,
  ADD COLUMN IF NOT EXISTS refund_payment_method TEXT,
  ADD COLUMN IF NOT EXISTS return_reason TEXT;

-- Étendre le check status (ajout trial_returned + finalized)
ALTER TABLE adoption_contracts DROP CONSTRAINT IF EXISTS adoption_contracts_status_check;
ALTER TABLE adoption_contracts ADD CONSTRAINT adoption_contracts_status_check
  CHECK (status IN ('draft','active','trial_returned','finalized','cancelled'));

-- Colonnes signature Documenso pour l'avenant d'annulation
ALTER TABLE adoption_contracts
  ADD COLUMN IF NOT EXISTS cancellation_documenso_document_id INTEGER,
  ADD COLUMN IF NOT EXISTS cancellation_documenso_recipient_id INTEGER,
  ADD COLUMN IF NOT EXISTS cancellation_documenso_signing_url TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_signature_status TEXT NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS cancellation_signature_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_signed_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_pdf_url TEXT;

ALTER TABLE adoption_contracts DROP CONSTRAINT IF EXISTS adoption_contracts_cancellation_signature_status_check;
ALTER TABLE adoption_contracts ADD CONSTRAINT adoption_contracts_cancellation_signature_status_check
  CHECK (cancellation_signature_status IN ('not_sent','pending','viewed','signed','rejected','failed'));

COMMENT ON COLUMN adoption_contracts.trial_period_days
  IS 'Override de la duree de periode d accueil. NULL = utilise establishments.default_trial_period_days';
COMMENT ON COLUMN adoption_contracts.non_refundable_amount
  IS 'Montant garde par le refuge en cas de retour pendant la periode d accueil (frais de dossier).';
COMMENT ON COLUMN adoption_contracts.refunded_amount
  IS 'Calcule a la prise en charge du retour : adoption_fee - non_refundable_amount.';
