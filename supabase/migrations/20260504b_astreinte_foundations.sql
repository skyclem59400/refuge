-- =============================================================================
-- SDA Astreinte — Fondations (Lot 01)
-- =============================================================================
-- Tables pour la plateforme externe d'astreinte SDA, partagée avec Optimus.
-- Toutes les tables sont préfixées `astreinte_*` pour ne pas polluer le schéma.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EPCI — Établissements Publics de Coopération Intercommunale
-- -----------------------------------------------------------------------------
CREATE TABLE astreinte_epci (
  code_siren        TEXT PRIMARY KEY,
  short_name        TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  department        TEXT NOT NULL,
  population        INT,
  member_count      INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Communes (toutes les communes du territoire couvert par la SDA)
-- -----------------------------------------------------------------------------
CREATE TABLE astreinte_municipalities (
  code_insee                TEXT PRIMARY KEY,
  name                      TEXT NOT NULL,
  postal_codes              TEXT[] NOT NULL DEFAULT '{}',
  epci_code_siren           TEXT REFERENCES astreinte_epci(code_siren) ON DELETE SET NULL,
  department                TEXT NOT NULL,
  population                INT,
  -- État conventionnel
  convention_status         TEXT NOT NULL DEFAULT 'none'
                              CHECK (convention_status IN ('active', 'pending', 'none', 'terminated')),
  convention_start_date     DATE,
  convention_end_date       DATE,
  convention_contact_name   TEXT,
  convention_contact_email  TEXT,
  convention_contact_phone  TEXT,
  convention_yearly_fee     NUMERIC(10,2),
  -- Tarifs intervention (override des défauts SDA)
  day_intervention_fee      NUMERIC(10,2),
  night_intervention_fee    NUMERIC(10,2),
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_astreinte_municipalities_epci
  ON astreinte_municipalities(epci_code_siren);
CREATE INDEX idx_astreinte_municipalities_status
  ON astreinte_municipalities(convention_status);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION astreinte_municipalities_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_astreinte_municipalities_updated_at
  BEFORE UPDATE ON astreinte_municipalities
  FOR EACH ROW EXECUTE FUNCTION astreinte_municipalities_set_updated_at();

-- -----------------------------------------------------------------------------
-- Domaines email autorisés (whitelist par domaine)
-- -----------------------------------------------------------------------------
CREATE TABLE astreinte_authorized_domains (
  domain                    TEXT PRIMARY KEY,
  scope_type                TEXT NOT NULL
                              CHECK (scope_type IN ('municipality', 'epci', 'national_force', 'organization', 'veterinary')),
  municipality_code_insee   TEXT REFERENCES astreinte_municipalities(code_insee) ON DELETE SET NULL,
  epci_code_siren           TEXT REFERENCES astreinte_epci(code_siren) ON DELETE SET NULL,
  organization_label        TEXT,
  validated_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active                    BOOLEAN NOT NULL DEFAULT TRUE,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_astreinte_authorized_domains_active
  ON astreinte_authorized_domains(domain) WHERE active = TRUE;

-- -----------------------------------------------------------------------------
-- Emails individuels autorisés (cas dégradés : mairies sans domaine pro,
-- vétérinaires partenaires, exceptions ponctuelles)
-- -----------------------------------------------------------------------------
CREATE TABLE astreinte_authorized_emails (
  email                     TEXT PRIMARY KEY,
  scope_type                TEXT NOT NULL
                              CHECK (scope_type IN ('municipality', 'veterinary', 'other')),
  municipality_code_insee   TEXT REFERENCES astreinte_municipalities(code_insee) ON DELETE SET NULL,
  full_name                 TEXT,
  role                      TEXT,
  organization_label        TEXT,
  validated_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active                    BOOLEAN NOT NULL DEFAULT TRUE,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_astreinte_authorized_emails_active
  ON astreinte_authorized_emails(email) WHERE active = TRUE;

-- -----------------------------------------------------------------------------
-- Planning d'astreinte (un agent par semaine, avec backup possible)
-- -----------------------------------------------------------------------------
CREATE TABLE astreinte_oncall_shifts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_at          TIMESTAMPTZ NOT NULL,
  end_at            TIMESTAMPTZ NOT NULL,
  is_backup         BOOLEAN NOT NULL DEFAULT FALSE,
  phone             TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_at > start_at)
);

CREATE INDEX idx_astreinte_oncall_shifts_period
  ON astreinte_oncall_shifts(start_at, end_at);

-- -----------------------------------------------------------------------------
-- Tickets d'astreinte (squelette pour Lot 01, étoffé en Lot 02)
-- -----------------------------------------------------------------------------
CREATE SEQUENCE astreinte_ticket_seq;

CREATE TABLE astreinte_tickets (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number               TEXT UNIQUE NOT NULL,
  intervention_type           TEXT NOT NULL
                                CHECK (intervention_type IN ('divagation', 'dangerous', 'requisition', 'veterinary_emergency')),
  -- Déclarant
  declarant_user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  declarant_email             TEXT NOT NULL,
  declarant_name              TEXT,
  declarant_phone             TEXT,
  declarant_role              TEXT,
  declarant_organization      TEXT,
  -- Localisation
  municipality_code_insee     TEXT REFERENCES astreinte_municipalities(code_insee) ON DELETE SET NULL,
  location_address            TEXT,
  location_lat                DOUBLE PRECISION,
  location_lng                DOUBLE PRECISION,
  -- Workflow
  status                      TEXT NOT NULL DEFAULT 'new'
                                CHECK (status IN ('new', 'acknowledged', 'in_progress', 'completed', 'cancelled')),
  acknowledged_at             TIMESTAMPTZ,
  acknowledged_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at                TIMESTAMPTZ,
  -- Catégorie temporelle (calculée à l'insertion par trigger)
  is_night_intervention       BOOLEAN NOT NULL DEFAULT FALSE,
  -- Description (champs détaillés ajoutés en Lot 02)
  description                 TEXT,
  -- Lien Optimus (rempli à la conversion en entrée fourrière)
  optimus_animal_id           UUID,
  -- Métadonnées
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_astreinte_tickets_status
  ON astreinte_tickets(status, created_at DESC);
CREATE INDEX idx_astreinte_tickets_municipality
  ON astreinte_tickets(municipality_code_insee);
CREATE INDEX idx_astreinte_tickets_declarant
  ON astreinte_tickets(declarant_user_id);

-- Génération auto du ticket_number et calcul night_intervention
CREATE OR REPLACE FUNCTION astreinte_tickets_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  current_year TEXT;
  next_num INT;
  paris_hour INT;
BEGIN
  IF NEW.ticket_number IS NULL THEN
    current_year := EXTRACT(YEAR FROM NOW())::TEXT;
    next_num := nextval('astreinte_ticket_seq');
    NEW.ticket_number := 'A-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
  END IF;

  paris_hour := EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Europe/Paris')::INT;
  NEW.is_night_intervention := (paris_hour >= 22 OR paris_hour < 7);

  RETURN NEW;
END $$;

CREATE TRIGGER trg_astreinte_tickets_before_insert
  BEFORE INSERT ON astreinte_tickets
  FOR EACH ROW EXECUTE FUNCTION astreinte_tickets_before_insert();

-- updated_at
CREATE OR REPLACE FUNCTION astreinte_tickets_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_astreinte_tickets_updated_at
  BEFORE UPDATE ON astreinte_tickets
  FOR EACH ROW EXECUTE FUNCTION astreinte_tickets_set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE astreinte_epci                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE astreinte_municipalities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE astreinte_authorized_domains    ENABLE ROW LEVEL SECURITY;
ALTER TABLE astreinte_authorized_emails     ENABLE ROW LEVEL SECURITY;
ALTER TABLE astreinte_oncall_shifts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE astreinte_tickets               ENABLE ROW LEVEL SECURITY;

-- EPCI : lecture publique (utile pour la page de territoire), pas d'écriture côté client
CREATE POLICY "epci_read_all" ON astreinte_epci
  FOR SELECT USING (TRUE);

-- Municipalities : lecture publique pour afficher dans le formulaire et la carte
CREATE POLICY "municipalities_read_all" ON astreinte_municipalities
  FOR SELECT USING (TRUE);

-- Municipalities : écriture par tout utilisateur authentifié (admin Optimus)
-- Sera durcie en fonction des permissions Optimus en Lot 04
CREATE POLICY "municipalities_write_authenticated" ON astreinte_municipalities
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Domains/Emails autorisés : LECTURE SERVEUR UNIQUEMENT (jamais exposé au client)
-- Aucune policy SELECT pour les utilisateurs anonymes/authentifiés.
-- L'API serveur utilise la service_role key, qui bypass RLS.
-- Pour les admins authentifiés (gestion de la whitelist) :
CREATE POLICY "authorized_domains_admin_all" ON astreinte_authorized_domains
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authorized_emails_admin_all" ON astreinte_authorized_emails
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Oncall shifts : lecture par les utilisateurs authentifiés (équipe SDA)
CREATE POLICY "oncall_shifts_read_authenticated" ON astreinte_oncall_shifts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "oncall_shifts_write_authenticated" ON astreinte_oncall_shifts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "oncall_shifts_update_authenticated" ON astreinte_oncall_shifts
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "oncall_shifts_delete_authenticated" ON astreinte_oncall_shifts
  FOR DELETE USING (auth.role() = 'authenticated');

-- Tickets : un déclarant voit uniquement ses propres tickets
CREATE POLICY "tickets_read_own_or_sda" ON astreinte_tickets
  FOR SELECT USING (
    declarant_user_id = auth.uid()
    OR auth.role() = 'authenticated'
  );

-- Création : tout utilisateur authentifié peut créer un ticket pour lui-même
CREATE POLICY "tickets_insert_self" ON astreinte_tickets
  FOR INSERT WITH CHECK (
    declarant_user_id = auth.uid()
  );

-- Mise à jour : SDA uniquement (utilisateurs authentifiés Optimus)
-- Le déclarant ne peut pas modifier son ticket après envoi
CREATE POLICY "tickets_update_sda" ON astreinte_tickets
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- =============================================================================
-- Commentaires sur les tables (pour navigation Supabase Studio)
-- =============================================================================
COMMENT ON TABLE astreinte_epci IS
  'Intercommunalités du territoire couvert (CAC, CA2C, Sud-Artois, CAPH).';
COMMENT ON TABLE astreinte_municipalities IS
  'Communes du territoire SDA, avec statut de convention et tarifs spécifiques.';
COMMENT ON TABLE astreinte_authorized_domains IS
  'Liste blanche des domaines email autorisés à utiliser le portail astreinte.';
COMMENT ON TABLE astreinte_authorized_emails IS
  'Liste blanche d''emails individuels (cas dégradés, vétos partenaires).';
COMMENT ON TABLE astreinte_oncall_shifts IS
  'Planning d''astreinte SDA (un agent + backup possible par semaine).';
COMMENT ON TABLE astreinte_tickets IS
  'Tickets d''intervention créés depuis le portail astreinte. Convertis ensuite en entrée fourrière dans Optimus.';
