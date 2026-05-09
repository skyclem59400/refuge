-- =====================================================================
-- Lien direct dons / factures ↔ contact / contrat d'adoption
-- =====================================================================
ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS adoption_contract_id UUID REFERENCES adoption_contracts(id) ON DELETE SET NULL;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS adoption_contract_id UUID REFERENCES adoption_contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_donations_client_id
  ON donations(client_id) WHERE client_id IS NOT NULL;

-- UNIQUE partiel : un seul don / une seule facture par contrat d'adoption
CREATE UNIQUE INDEX IF NOT EXISTS uniq_donations_adoption_contract
  ON donations(adoption_contract_id) WHERE adoption_contract_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_documents_adoption_contract
  ON documents(adoption_contract_id) WHERE adoption_contract_id IS NOT NULL;

-- Backfill donations.client_id depuis donor_email (matching exact email + même établissement)
UPDATE donations d
SET client_id = c.id
FROM clients c
WHERE d.client_id IS NULL
  AND d.donor_email IS NOT NULL
  AND c.email = d.donor_email
  AND c.establishment_id = d.establishment_id;

-- Backfill adoption_contract_id depuis le marqueur dans les notes
UPDATE donations d
SET adoption_contract_id = (
  substring(d.notes from 'astreinte-adoption-ref:([0-9a-f-]+)')
)::uuid
WHERE d.adoption_contract_id IS NULL
  AND d.notes ~ 'astreinte-adoption-ref:[0-9a-f-]+';

UPDATE documents doc
SET adoption_contract_id = (
  substring(doc.notes from 'astreinte-adoption-ref:([0-9a-f-]+)')
)::uuid
WHERE doc.adoption_contract_id IS NULL
  AND doc.notes ~ 'astreinte-adoption-ref:[0-9a-f-]+';
