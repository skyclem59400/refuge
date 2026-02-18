-- ============================================================
-- Multi-etablissement + permissions granulaires
-- ============================================================

-- 1. Table etablissements
CREATE TABLE establishments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  email       TEXT DEFAULT '',
  phone       TEXT DEFAULT '',
  website     TEXT DEFAULT '',
  iban        TEXT DEFAULT '',
  bic         TEXT DEFAULT '',
  address     TEXT DEFAULT '',
  legal_name  TEXT DEFAULT '',
  logo_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Table membres
CREATE TABLE establishment_members (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id      UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role                  TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  manage_documents      BOOLEAN NOT NULL DEFAULT false,
  manage_clients        BOOLEAN NOT NULL DEFAULT false,
  manage_establishment  BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, user_id)
);

CREATE INDEX idx_estab_members_user ON establishment_members(user_id);
CREATE INDEX idx_estab_members_estab ON establishment_members(establishment_id);

-- 3. Ajouter establishment_id aux tables existantes
ALTER TABLE documents ADD COLUMN establishment_id UUID REFERENCES establishments(id);
ALTER TABLE clients   ADD COLUMN establishment_id UUID REFERENCES establishments(id);

CREATE INDEX idx_documents_estab ON documents(establishment_id);
CREATE INDEX idx_clients_estab ON clients(establishment_id);

-- 4. Migration des donnees existantes
DO $$
DECLARE
  default_est_id UUID;
  company_info JSONB;
  admin_uid UUID;
BEGIN
  -- Extraire company_info
  SELECT value::jsonb INTO company_info FROM settings WHERE key = 'company_info';

  -- Creer l'etablissement par defaut
  INSERT INTO establishments (name, description, email, phone, website, iban, bic, address, legal_name)
  VALUES (
    COALESCE(company_info->>'name', 'La Ferme O 4 Vents'),
    COALESCE(company_info->>'description', ''),
    COALESCE(company_info->>'email', ''),
    COALESCE(company_info->>'phone', ''),
    COALESCE(company_info->>'website', ''),
    COALESCE(company_info->>'iban', ''),
    COALESCE(company_info->>'bic', ''),
    COALESCE(company_info->>'address', ''),
    COALESCE(company_info->>'legal_name', '')
  )
  RETURNING id INTO default_est_id;

  -- Rattacher toutes les donnees
  UPDATE documents SET establishment_id = default_est_id;
  UPDATE clients   SET establishment_id = default_est_id;

  -- Trouver l'admin (clement.scailteux@gmail.com ou l'utilisateur le plus actif)
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'clement.scailteux@gmail.com' LIMIT 1;

  IF admin_uid IS NULL THEN
    SELECT created_by INTO admin_uid FROM documents WHERE created_by IS NOT NULL
    GROUP BY created_by ORDER BY COUNT(*) DESC LIMIT 1;
  END IF;

  IF admin_uid IS NOT NULL THEN
    INSERT INTO establishment_members (establishment_id, user_id, role, manage_documents, manage_clients, manage_establishment)
    VALUES (default_est_id, admin_uid, 'admin', true, true, true);
  END IF;

  -- Ajouter les autres utilisateurs comme membres
  INSERT INTO establishment_members (establishment_id, user_id, role, manage_documents, manage_clients, manage_establishment)
  SELECT DISTINCT default_est_id, created_by, 'member', true, true, false
  FROM documents
  WHERE created_by IS NOT NULL AND created_by != COALESCE(admin_uid, '00000000-0000-0000-0000-000000000000'::uuid)
  ON CONFLICT DO NOTHING;
END $$;

-- 5. Rendre NOT NULL apres migration
ALTER TABLE documents ALTER COLUMN establishment_id SET NOT NULL;
ALTER TABLE clients   ALTER COLUMN establishment_id SET NOT NULL;

-- 6. Mettre a jour la numerotation pour scoper par etablissement
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
    CAST(SUBSTRING(numero FROM LENGTH(prefix) + 2 + LENGTH(year_str)) AS INT)
  ), 0) + 1
  INTO next_num
  FROM documents
  WHERE type = doc_type
    AND numero LIKE prefix || '-' || year_str || '-%'
    AND (est_id IS NULL OR establishment_id = est_id);

  RETURN prefix || '-' || year_str || '-' || LPAD(next_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 7. Triggers updated_at
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER tr_establishments_updated BEFORE UPDATE ON establishments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_estab_members_updated BEFORE UPDATE ON establishment_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 8. Fonction lookup user par email (pour ajout membres)
CREATE OR REPLACE FUNCTION get_user_id_by_email(lookup_email TEXT)
RETURNS UUID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM auth.users WHERE email = lookup_email LIMIT 1;
$$;

-- 9. RLS Policies
ALTER TABLE establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE establishment_members ENABLE ROW LEVEL SECURITY;

-- Establishments : lecture pour les membres
CREATE POLICY "estab_select" ON establishments FOR SELECT
  USING (id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

CREATE POLICY "estab_update" ON establishments FOR UPDATE
  USING (id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid() AND (role = 'admin' OR manage_establishment)));

CREATE POLICY "estab_insert" ON establishments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Members
CREATE POLICY "members_select" ON establishment_members FOR SELECT
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

CREATE POLICY "members_insert" ON establishment_members FOR INSERT
  WITH CHECK (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid() AND (role = 'admin' OR manage_establishment)));

CREATE POLICY "members_update" ON establishment_members FOR UPDATE
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid() AND (role = 'admin' OR manage_establishment)));

CREATE POLICY "members_delete" ON establishment_members FOR DELETE
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid() AND (role = 'admin' OR manage_establishment)) AND user_id != auth.uid());

-- Documents : scoped par etablissement
CREATE POLICY "docs_estab_select" ON documents FOR SELECT
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

CREATE POLICY "docs_estab_insert" ON documents FOR INSERT
  WITH CHECK (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid() AND (role = 'admin' OR manage_documents)));

CREATE POLICY "docs_estab_update" ON documents FOR UPDATE
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid() AND (role = 'admin' OR manage_documents)));

CREATE POLICY "docs_estab_delete" ON documents FOR DELETE
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid() AND (role = 'admin' OR manage_documents)));

-- Clients : scoped par etablissement
CREATE POLICY "clients_estab_select" ON clients FOR SELECT
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()));

CREATE POLICY "clients_estab_insert" ON clients FOR INSERT
  WITH CHECK (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid() AND (role = 'admin' OR manage_clients)));

CREATE POLICY "clients_estab_update" ON clients FOR UPDATE
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid() AND (role = 'admin' OR manage_clients)));

CREATE POLICY "clients_estab_delete" ON clients FOR DELETE
  USING (establishment_id IN (SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid() AND (role = 'admin' OR manage_clients)));
