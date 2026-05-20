-- ============================================================
-- User profiles + onboarding obligatoire
-- ============================================================
-- Force la saisie d'infos personnelles completes pour TOUS les
-- utilisateurs au prochain login. Permet la migration progressive
-- des comptes pseudo (prenom + mdp) vers des comptes email reels.
-- Source de verite : user_profiles. Cache rapide : auth.users.raw_user_meta_data.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_name TEXT,
  first_name TEXT,
  personal_email TEXT,
  phone TEXT,
  birth_date DATE,
  address_label TEXT,
  address_postcode TEXT,
  address_city TEXT,
  address_lat NUMERIC,
  address_lng NUMERIC,
  address_ban_id TEXT,
  profile_completed BOOLEAN NOT NULL DEFAULT false,
  profile_completed_at TIMESTAMPTZ,
  email_migrated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email
  ON user_profiles(lower(personal_email)) WHERE personal_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_completed
  ON user_profiles(profile_completed);

-- Trigger updated_at (idempotent — la fonction existe deja dans le projet)
DROP TRIGGER IF EXISTS tr_user_profiles_updated ON user_profiles;
CREATE TRIGGER tr_user_profiles_updated
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger : creer un profil vide a chaque nouveau auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, profile_completed)
  VALUES (NEW.id, false)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Backfill pour les users existants : profil vide, profile_completed = false
INSERT INTO user_profiles (user_id, profile_completed)
SELECT id, false FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_self_select ON user_profiles;
CREATE POLICY user_profiles_self_select ON user_profiles
  FOR SELECT USING (user_id = auth.uid());

-- Les membres d'un meme etablissement peuvent voir les profils des autres membres
-- (utile pour l'annuaire, la gestion des conges, etc.)
DROP POLICY IF EXISTS user_profiles_estab_select ON user_profiles;
CREATE POLICY user_profiles_estab_select ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM establishment_members em
      WHERE em.user_id = user_profiles.user_id
        AND em.establishment_id IN (SELECT user_establishment_ids())
    )
  );

DROP POLICY IF EXISTS user_profiles_self_update ON user_profiles;
CREATE POLICY user_profiles_self_update ON user_profiles
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- INSERT volontairement non expose en RLS : passe par le trigger (creation auto)
-- ou par le service_role (server action completeUserProfile).

COMMENT ON TABLE user_profiles IS
  'Infos personnelles obligatoires pour acceder a la plateforme.
   Bloquant tant que profile_completed = false (middleware redirige vers /onboarding).
   email_migrated = true quand un compte pseudo a basculé sur un vrai email perso.';
