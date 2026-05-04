-- =====================================================================
-- Astreinte Lot 03b — Champs de facturation (commune ou EPCI)
-- =====================================================================
ALTER TABLE astreinte_municipalities
  ADD COLUMN IF NOT EXISTS billing_entity TEXT NOT NULL DEFAULT 'commune'
    CHECK (billing_entity IN ('commune', 'epci'));

COMMENT ON COLUMN astreinte_municipalities.billing_entity IS
  'Entité facturée pour les interventions de nuit : commune ou EPCI (selon convention).';

ALTER TABLE astreinte_municipalities
  ADD COLUMN IF NOT EXISTS billing_address      TEXT,
  ADD COLUMN IF NOT EXISTS billing_postal_code  TEXT,
  ADD COLUMN IF NOT EXISTS billing_city         TEXT,
  ADD COLUMN IF NOT EXISTS billing_email        TEXT;

ALTER TABLE astreinte_epci
  ADD COLUMN IF NOT EXISTS billing_name         TEXT,
  ADD COLUMN IF NOT EXISTS billing_address      TEXT,
  ADD COLUMN IF NOT EXISTS billing_postal_code  TEXT,
  ADD COLUMN IF NOT EXISTS billing_city         TEXT,
  ADD COLUMN IF NOT EXISTS billing_email        TEXT,
  ADD COLUMN IF NOT EXISTS night_intervention_fee NUMERIC(10,2);

ALTER TABLE astreinte_tickets
  ADD COLUMN IF NOT EXISTS optimus_invoice_id UUID REFERENCES documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_astreinte_tickets_invoice
  ON astreinte_tickets(optimus_invoice_id) WHERE optimus_invoice_id IS NOT NULL;
