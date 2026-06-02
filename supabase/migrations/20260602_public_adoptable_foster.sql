-- Visibilité publique des animaux adoptables : inclure l'accueil temporaire.
--
-- Avant : la policy "Public can view adoptable animals" (rôle anon) n'autorisait la
-- lecture que des animaux `adoptable = true AND status = 'shelter'`. Un animal proposé
-- à l'adoption mais hébergé en famille d'accueil (`foster_family`) en était exclu —
-- il ne "basculait" pas sur sda-nord.com (cf. cas Mamie-Simone).
--
-- Après : `shelter` + `foster_family`, cohérent avec le filtre du site public
-- (app/animaux + home) et avec la policy parrainage `animals_public_select_sheltered`.
-- La policy parrainage couvrait déjà foster_family pour role public, mais cette policy-ci
-- est la source de vérité nommée pour la visibilité "adoptable" : on l'aligne pour éviter
-- toute régression si la policy parrainage est un jour resserrée (defense in depth).

drop policy if exists "Public can view adoptable animals" on public.animals;

create policy "Public can view adoptable animals"
  on public.animals
  for select
  to anon
  using (adoptable = true and status in ('shelter', 'foster_family'));
