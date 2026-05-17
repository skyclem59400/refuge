-- Archive vivante des contacts importés depuis d'anciens logiciels (Hunimalis,
-- éventuellement d'autres demain). Séparée de `clients` pour ne pas polluer le
-- répertoire actif, mais consultable depuis le CRM (recherche + conversion).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS legacy_contacts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id        UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  source                  TEXT NOT NULL DEFAULT 'hunimalis_2026',
  full_name               TEXT NOT NULL,
  -- Version lowercase sans accents pour recherche trigram (insensible casse/accent)
  full_name_normalized    TEXT NOT NULL,
  address                 TEXT,
  postal_code             TEXT,
  city                    TEXT,
  phone                   TEXT,
  -- Format E.164 quand reconnaissable, sinon copie de phone strippé
  phone_normalized        TEXT,
  -- Si converti en client actif, on garde le lien (mais ne supprime pas la ligne)
  converted_to_client_id  UUID REFERENCES clients(id) ON DELETE SET NULL,
  converted_at            TIMESTAMPTZ,
  converted_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  imported_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes                   TEXT
);

CREATE INDEX IF NOT EXISTS idx_legacy_contacts_estab ON legacy_contacts(establishment_id);
-- Recherche fuzzy sur nom : trigram permet "ABRAHAM" trouve "Abrahams", typos, etc.
CREATE INDEX IF NOT EXISTS idx_legacy_contacts_name_trgm ON legacy_contacts USING gin (full_name_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_legacy_contacts_phone ON legacy_contacts(phone_normalized) WHERE phone_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_legacy_contacts_city ON legacy_contacts(city);
CREATE INDEX IF NOT EXISTS idx_legacy_contacts_converted ON legacy_contacts(converted_to_client_id) WHERE converted_to_client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_legacy_contacts_source ON legacy_contacts(source);

ALTER TABLE legacy_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legacy_contacts_select" ON legacy_contacts;
DROP POLICY IF EXISTS "legacy_contacts_insert" ON legacy_contacts;
DROP POLICY IF EXISTS "legacy_contacts_update" ON legacy_contacts;
DROP POLICY IF EXISTS "legacy_contacts_delete" ON legacy_contacts;

CREATE POLICY "legacy_contacts_select" ON legacy_contacts FOR SELECT USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "legacy_contacts_insert" ON legacy_contacts FOR INSERT WITH CHECK (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "legacy_contacts_update" ON legacy_contacts FOR UPDATE USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
CREATE POLICY "legacy_contacts_delete" ON legacy_contacts FOR DELETE USING (
  establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid())
);
