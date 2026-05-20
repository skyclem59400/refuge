-- ============================================================
-- SDA Refuge — Liste noire des propriétaires (procédure judiciaire)
-- Migration: 20260520d_judicial_blacklist
-- ============================================================
-- Étend la table `clients` avec un drapeau `is_blacklisted` + métadonnées
-- (raison, source, qui/quand inscrit + qui/quand retiré).
-- Étend la table `animals` avec `judicial_owner_client_id` pour pointer
-- vers la fiche propriétaire (réutilisation des données) tout en gardant
-- `judicial_owner_name` comme snapshot pour PDFs déjà émis.
-- Ajoute `possible_blacklist_match` à `adoption_inquiries` pour signaler
-- les matches faibles (nom+prénom seul, sans email/birth_date).
-- Fournit la fonction `check_adopter_blacklist` pour le matching.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- 1. Extension de la table clients ---------------------------------------
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blacklist_reason TEXT,
  ADD COLUMN IF NOT EXISTS blacklist_source TEXT,
  ADD COLUMN IF NOT EXISTS blacklisted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blacklisted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blacklist_removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blacklist_removed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blacklist_removal_reason TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS birth_place TEXT,
  ADD COLUMN IF NOT EXISTS national_id TEXT;

ALTER TABLE clients
  DROP CONSTRAINT IF EXISTS clients_blacklist_source_check;
ALTER TABLE clients
  ADD CONSTRAINT clients_blacklist_source_check
    CHECK (blacklist_source IS NULL OR blacklist_source IN ('judicial_procedure', 'manual', 'incident'));

COMMENT ON COLUMN clients.is_blacklisted IS 'Le contact est inscrit sur la liste noire SDA — empêche/limite les adoptions futures.';
COMMENT ON COLUMN clients.blacklist_reason IS 'Motif détaillé de l''inscription sur la liste noire.';
COMMENT ON COLUMN clients.blacklist_source IS 'Origine de l''inscription : judicial_procedure | manual | incident.';
COMMENT ON COLUMN clients.blacklisted_at IS 'Date d''inscription sur la liste noire.';
COMMENT ON COLUMN clients.blacklisted_by IS 'Utilisateur ayant inscrit le contact sur la liste noire.';
COMMENT ON COLUMN clients.blacklist_removed_at IS 'Date de retrait de la liste noire (NULL si encore actif).';
COMMENT ON COLUMN clients.blacklist_removed_by IS 'Utilisateur ayant retiré le contact (admin only).';
COMMENT ON COLUMN clients.blacklist_removal_reason IS 'Motif justifiant le retrait de la liste noire (audit critique).';
COMMENT ON COLUMN clients.birth_date IS 'Date de naissance — utilisée notamment pour le matching liste noire.';
COMMENT ON COLUMN clients.birth_place IS 'Lieu de naissance.';
COMMENT ON COLUMN clients.national_id IS 'Numéro de pièce d''identité éventuelle (optionnel, pour dossier judiciaire).';

-- 2. Extension de la table animals --------------------------------------
ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS judicial_owner_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

COMMENT ON COLUMN animals.judicial_owner_client_id IS 'Lien vers la fiche du propriétaire mis en cause (table clients). judicial_owner_name reste rempli comme snapshot lisible humainement (PDF déjà émis).';

-- 3. Flag inquiry pour match faible -------------------------------------
ALTER TABLE adoption_inquiries
  ADD COLUMN IF NOT EXISTS possible_blacklist_match BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN adoption_inquiries.possible_blacklist_match IS 'Vrai si la demande matche un contact blacklisté uniquement par nom+prénom (signal faible, à vérifier par l''équipe).';

-- 4. Index optimisés ----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_clients_blacklisted
  ON clients(establishment_id) WHERE is_blacklisted = true;

CREATE INDEX IF NOT EXISTS idx_clients_blacklist_match
  ON clients(lower(name), lower(coalesce(first_name, ''))) WHERE is_blacklisted = true;

CREATE INDEX IF NOT EXISTS idx_animals_judicial_owner_client
  ON animals(judicial_owner_client_id) WHERE judicial_owner_client_id IS NOT NULL;

-- 5. Fonction de matching ------------------------------------------------
CREATE OR REPLACE FUNCTION check_adopter_blacklist(
  p_establishment_id UUID,
  p_last_name TEXT,
  p_first_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL
) RETURNS TABLE (
  client_id UUID,
  match_strength TEXT,
  client_name TEXT,
  client_first_name TEXT,
  blacklist_reason TEXT,
  blacklist_source TEXT,
  blacklisted_at TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  -- exact email
  SELECT c.id, 'exact_email'::TEXT,
         c.name, c.first_name,
         c.blacklist_reason, c.blacklist_source, c.blacklisted_at
  FROM clients c
  WHERE c.establishment_id = p_establishment_id
    AND c.is_blacklisted = true
    AND p_email IS NOT NULL
    AND c.email IS NOT NULL
    AND lower(c.email) = lower(p_email)

  UNION

  -- exact phone (normalisé en retirant tout non-chiffre, min 8 chiffres)
  SELECT c.id, 'exact_phone'::TEXT,
         c.name, c.first_name,
         c.blacklist_reason, c.blacklist_source, c.blacklisted_at
  FROM clients c
  WHERE c.establishment_id = p_establishment_id
    AND c.is_blacklisted = true
    AND p_phone IS NOT NULL
    AND c.phone IS NOT NULL
    AND regexp_replace(c.phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
    AND length(regexp_replace(p_phone, '\D', '', 'g')) >= 8

  UNION

  -- nom+prénom+date_naissance
  SELECT c.id, 'name_birthdate'::TEXT,
         c.name, c.first_name,
         c.blacklist_reason, c.blacklist_source, c.blacklisted_at
  FROM clients c
  WHERE c.establishment_id = p_establishment_id
    AND c.is_blacklisted = true
    AND lower(unaccent(c.name)) = lower(unaccent(p_last_name))
    AND lower(unaccent(coalesce(c.first_name, ''))) = lower(unaccent(coalesce(p_first_name, '')))
    AND p_birth_date IS NOT NULL
    AND c.birth_date = p_birth_date

  UNION

  -- nom+prénom seul (signal faible)
  SELECT c.id, 'name_only'::TEXT,
         c.name, c.first_name,
         c.blacklist_reason, c.blacklist_source, c.blacklisted_at
  FROM clients c
  WHERE c.establishment_id = p_establishment_id
    AND c.is_blacklisted = true
    AND lower(unaccent(c.name)) = lower(unaccent(p_last_name))
    AND lower(unaccent(coalesce(c.first_name, ''))) = lower(unaccent(coalesce(p_first_name, '')))
    AND coalesce(p_first_name, '') <> '';
$$;

COMMENT ON FUNCTION check_adopter_blacklist IS
  'Détecte si un demandeur d''adoption matche un contact blacklisté.
   Retourne plusieurs lignes possibles, avec match_strength :
     - exact_email (le plus fort)
     - exact_phone
     - name_birthdate
     - name_only (le plus faible, à valider manuellement)
   Côté code, on bloque automatiquement sur les 3 premiers et on flag
   l''inquiry en `possible_blacklist_match` pour le 4e.';

-- 6. RLS — on conserve la policy existante "clients" (déjà filtrée par
-- establishment_id). Les écritures du flag passent en service_role via
-- Server Actions qui vérifient explicitement `requirePermission` et le
-- rôle admin pour le retrait. Pas de policy supplémentaire nécessaire.
