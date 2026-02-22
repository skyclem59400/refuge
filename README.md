# Optimus - Logiciel de refuge

Application de gestion multi-etablissement pour **La Ferme O 4 Vents** (exploitation agricole) et **SDA Estormel** (refuge animalier).

Facturation, gestion d'animaux, suivi sanitaire, dons avec recus fiscaux CERFA, declarations I-CAD, generation de posts IA.

**Production** : [crm.skyclem.fr](https://crm.skyclem.fr)

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 16 (App Router, React 19, TypeScript 5) |
| Base de donnees | Supabase (PostgreSQL, Auth, Storage, RLS) |
| Styles | Tailwind CSS v4 (theme custom, dark/light mode) |
| PDF | Puppeteer (factures, devis, avoirs, CERFA) |
| IA | Claude API via `@anthropic-ai/sdk` (generation de posts) |
| Graphiques | Recharts |
| Icones | Lucide React |
| Notifications | Sonner |
| Deploiement | Docker multi-stage (Coolify sur VPS) |

---

## Demarrage rapide

### Prerequis

- **Node.js** 20+
- Un compte **Supabase** avec la base de donnees configuree
- Une cle API **Anthropic** (pour la generation IA de posts) — [console.anthropic.com](https://console.anthropic.com/settings/keys)

### Installation

```bash
git clone https://github.com/skyclem59400/refuge.git
cd refuge
npm install
```

### Configuration

Creer un fichier `.env.local` a la racine :

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Base de donnees

Executer les migrations SQL dans l'editeur SQL de Supabase (Dashboard > SQL Editor), **dans l'ordre** :

1. `supabase/migrations/002_establishments.sql` — Multi-etablissement, membres, permissions
2. `supabase/migrations/20260221_sda_animals.sql` — Animaux, photos, mouvements, sante
3. `supabase/migrations/20260221_sda_complete.sql` — Boxes, jours feries, permissions SDA
4. `supabase/migrations/20260221_social_posts.sql` — Publications reseaux sociaux
5. `supabase/migrations/20260221_donations.sql` — Dons et numerotation CERFA
6. `supabase/migrations/20260221_icad.sql` — Declarations I-CAD

### Buckets de stockage

Creer les buckets dans Supabase Storage :

```sql
-- Logos d'etablissements
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);
CREATE POLICY "logos_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.uid() IS NOT NULL);
CREATE POLICY "logos_update" ON storage.objects FOR UPDATE USING (bucket_id = 'logos' AND auth.uid() IS NOT NULL);
CREATE POLICY "logos_read" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "logos_delete" ON storage.objects FOR DELETE USING (bucket_id = 'logos' AND auth.uid() IS NOT NULL);

-- Avatars utilisateurs
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
CREATE POLICY "avatars_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "avatars_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

-- Photos d'animaux
INSERT INTO storage.buckets (id, name, public) VALUES ('animal-photos', 'animal-photos', true);
CREATE POLICY "animal_photos_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'animal-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "animal_photos_update" ON storage.objects FOR UPDATE USING (bucket_id = 'animal-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "animal_photos_read" ON storage.objects FOR SELECT USING (bucket_id = 'animal-photos');
CREATE POLICY "animal_photos_delete" ON storage.objects FOR DELETE USING (bucket_id = 'animal-photos' AND auth.uid() IS NOT NULL);
```

### Lancer l'application

```bash
npm run dev
```

Ouvrir **http://localhost:3000**. A la premiere connexion, l'application redirige vers `/setup` pour creer l'etablissement initial.

---

## Fonctionnalites

### Authentification

- **Google SSO** = methode de connexion principale (bouton en premier sur `/login`)
- **Email/mot de passe** = cache derriere un lien "Connexion administrateur" (reserve a l'admin)
- Session geree par cookies (compatible Server Components)
- Middleware de protection : toutes les pages sauf `/login` necessitent une authentification
- Nouvel utilisateur Google sans etablissement → page d'attente (`/setup`)
- L'admin ajoute manuellement les utilisateurs en attente depuis `/etablissement`
- Seul `clement.scailteux@gmail.com` peut creer un etablissement

### Multi-etablissement

- Un utilisateur peut appartenir a plusieurs etablissements
- Types d'etablissement : `farm` (ferme), `shelter` (refuge), `both` (les deux)
- Switcher d'etablissement dans le sidebar (dropdown)
- Donnees isolees par etablissement (documents, clients, animaux)
- Cookie httpOnly `current-establishment-id` pour le contexte serveur
- Navigation dynamique selon le type d'etablissement
- Page d'attente `/setup` pour les nouveaux utilisateurs (validation admin requise)

### Permissions granulaires

| Role | Description |
|------|-------------|
| `admin` | Acces complet a toutes les fonctionnalites |
| `member` | Acces configurable par permission |

| Permission | Portee |
|------------|--------|
| `canManageDocuments` | Creer, modifier, supprimer des documents |
| `canManageClients` | Creer, modifier, supprimer des clients |
| `canManageEstablishment` | Editer les infos de l'etablissement, gerer les membres |
| `canViewAnimals` | Consulter les fiches animaux |
| `canManageAnimals` | Creer, modifier, supprimer des animaux |
| `canManageHealth` | Gerer les dossiers de sante |
| `canManageMovements` | Gerer les mouvements et declarations I-CAD |
| `canManageBoxes` | Gerer les enclos et cages |
| `canManagePosts` | Gerer les publications reseaux sociaux |
| `canManageDonations` | Gerer les dons et recus CERFA |
| `canViewPound` | Consulter la fourriere |
| `canViewStatistics` | Acceder aux statistiques |

Securite a 3 niveaux :
1. **RLS PostgreSQL** — filtrage au niveau de la base
2. **`requirePermission()`** — verification dans les Server Actions
3. **UI conditionnelle** — masquage des boutons/pages sans permission

### Dashboard

- Statistiques en temps reel (documents, CA paye, montant en attente)
- Graphique de chiffre d'affaires interactif (granularite jour/semaine/mois, mode ligne/barres)
- 5 documents les plus recents
- Donnees scopees par etablissement

### Documents (devis, factures, avoirs)

- Types : devis, facture, avoir
- Numerotation automatique scopee par etablissement (`D-2026-001`, `F-2026-001`, `A-2026-001`)
- Recherche client par autocomplete
- Calcul automatique du total (adultes + enfants)
- Apercu en direct du document
- Changement de statut (brouillon, envoye, paye, annule)
- Conversion devis vers facture
- Annulation de facture avec creation d'avoir
- Generation PDF avec logo et infos de l'etablissement

### Clients

- Fiche client avec informations de contact (particulier / organisation)
- Statistiques par client (documents, CA)
- Historique des documents lies
- Recherche en temps reel
- Protection contre la suppression si documents lies

### Module refuge (SDA)

#### Animaux (`/animals`)

- Fiche complete : espece (chat/chien), race, croise, sexe, date de naissance, poids, couleur, puce, tatouage
- Statuts : fourriere, refuge, adopte, restitue, transfere, decede, euthanasie
- Origines : fourriere, abandon, saisie, naissance, transfert
- Liste avec filtres (espece, statut) et recherche par nom
- Detail en onglets : Infos, Photos, Sante, Mouvements, Publications, I-CAD

#### Photos

- Upload multiple d'images
- Designation d'une photo principale
- Galerie avec apercu dans la fiche animal

#### Sante (`/health`)

- Types : vaccination, sterilisation, antiparasitaire, consultation, chirurgie, medicament, evaluation comportementale
- Historique complet par animal avec dates et notes
- Page dediee avec filtres et statistiques

#### Mouvements

- Types : entree fourriere, adoption, retour proprietaire, transfert sortant, deces, euthanasie
- Historique chronologique dans la fiche animal
- Lien avec le contact (adoptant, proprietaire)

#### Fourriere (`/pound`)

- Suivi des entrees avec delais legaux
- Compteur de jours depuis l'entree
- Statut de garde (en cours, termine)

#### Boxes (`/boxes`)

- Gestion des enclos et cages
- Espece assignee (chat, chien, mixte)
- Capacite et taux d'occupation

#### I-CAD (`/icad`)

- 10 types de declarations : entree fourriere, transfert refuge, adoption, retour proprietaire, transfert sortant, deces, euthanasie, identification, changement proprietaire, changement adresse
- 6 statuts : en attente, soumise, confirmee, rejetee, erreur, non requise
- Page admin avec grille de statistiques, alerte declarations en attente, filtres par statut
- Boutons d'action rapide (Soumise / Confirmee / N/A) dans la fiche animal et la page admin
- Reference I-CAD, suivi des erreurs et compteur de tentatives

#### Dons (`/donations`)

- Saisie des dons : nom, email, telephone, adresse du donateur
- Moyens de paiement : cheque, virement, especes, CB, prelevement, autre
- Nature du don : numeraire, nature
- Statistiques annuelles : total, nombre, CERFA generes, don moyen
- Filtre par annee

#### CERFA (recus fiscaux)

- Generation automatique du recu fiscal **CERFA n°11580*04**
- Numerotation automatique des CERFA scopee par etablissement
- Montant en toutes lettres (conversion automatique en francais)
- Sections conformes : organisme beneficiaire, donateur, montant, nature du don, mode de versement
- References articles 200 et 238 bis du CGI
- Generation PDF via Puppeteer
- Telechargement direct depuis la liste des dons

#### Publications IA (`/animals/[id]` > onglet Publications)

- Generation assistee par **Claude AI** (modele Haiku 4.5)
- 2 types de posts : recherche de proprietaire, adoption
- Multi-plateforme : Facebook, Instagram, Twitter
- Flux en 3 etapes : configuration → generation → apercu/edition
- Historique des publications dans la fiche animal

### Gestion de l'etablissement (`/etablissement`)

- Edition des informations (nom, raison sociale, email, tel, adresse, IBAN, BIC)
- Upload du logo (Supabase Storage, bucket `logos`)
- Gestion des membres : toggles de permissions, suppression
- Section "Utilisateurs en attente" : nouveaux users Google sans etablissement, avec bouton d'ajout
- Section "Inviter un utilisateur" : recherche parmi les users existants non-membres
- Accessible uniquement aux admins et membres avec `manage_establishment`

### Compte utilisateur (`/compte`)

- Upload d'avatar (Supabase Storage, bucket `avatars`)
- Modification du nom
- Changement d'email (avec confirmation par mail)
- Changement de mot de passe (verification de l'ancien)
- Avatar affiche dans le header

### Theme

- Mode clair et mode sombre
- Toggle accessible depuis le header
- Persistance dans localStorage
- Variables CSS pour les deux themes

---

## Structure du projet

```
refuge/
├── Dockerfile
├── .dockerignore
├── middleware.ts
├── next.config.ts
│
├── supabase/migrations/              # Migrations SQL (6 fichiers)
│   ├── 002_establishments.sql
│   ├── 20260221_sda_animals.sql
│   ├── 20260221_sda_complete.sql
│   ├── 20260221_social_posts.sql
│   ├── 20260221_donations.sql
│   └── 20260221_icad.sql
│
└── src/
    ├── app/
    │   ├── layout.tsx                    # Layout racine + ThemeProvider
    │   ├── globals.css                   # Variables theme light/dark
    │   ├── page.tsx                      # Redirect → /dashboard
    │   ├── login/page.tsx                # Connexion (Google SSO + email admin)
    │   ├── setup/page.tsx                # Page d'attente (validation admin)
    │   │
    │   ├── (app)/                        # Routes authentifiees
    │   │   ├── layout.tsx                # Sidebar + Header + contexte etablissement
    │   │   ├── dashboard/page.tsx
    │   │   ├── documents/
    │   │   │   ├── page.tsx
    │   │   │   ├── nouveau/page.tsx
    │   │   │   └── [id]/edit/page.tsx
    │   │   ├── clients/
    │   │   │   ├── page.tsx
    │   │   │   ├── nouveau/page.tsx
    │   │   │   └── [id]/page.tsx
    │   │   ├── animals/
    │   │   │   ├── page.tsx              # Liste des animaux
    │   │   │   ├── nouveau/page.tsx      # Creer un animal
    │   │   │   └── [id]/page.tsx         # Detail animal (6 onglets)
    │   │   ├── health/page.tsx           # Dossiers de sante
    │   │   ├── pound/page.tsx            # Fourriere
    │   │   ├── boxes/page.tsx            # Enclos / cages
    │   │   ├── icad/page.tsx             # Declarations I-CAD
    │   │   ├── donations/
    │   │   │   ├── page.tsx              # Liste des dons + stats
    │   │   │   └── nouveau/page.tsx      # Creer/editer un don
    │   │   ├── etablissement/page.tsx    # Admin etablissement
    │   │   └── compte/page.tsx           # Compte utilisateur
    │   │
    │   ├── api/
    │   │   ├── pdf/[documentId]/route.ts       # PDF documents
    │   │   ├── pdf/cerfa/[donationId]/route.ts # PDF CERFA
    │   │   └── ai/generate-post/route.ts       # API Claude (posts IA)
    │   │
    │   └── auth/callback/route.ts        # Callback OAuth
    │
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts                 # Client navigateur
    │   │   ├── server.ts                 # Client serveur + admin (bypass RLS)
    │   │   └── middleware.ts
    │   ├── establishment/
    │   │   ├── context.ts                # getEstablishmentContext(), getUserEstablishments()
    │   │   └── permissions.ts            # requirePermission(), requireEstablishment()
    │   ├── actions/
    │   │   ├── documents.ts              # CRUD documents
    │   │   ├── clients.ts                # CRUD clients
    │   │   ├── establishments.ts         # CRUD etablissement + membres
    │   │   ├── account.ts                # Profil, email, mot de passe
    │   │   ├── switch-establishment.ts   # Changement d'etablissement (cookie)
    │   │   ├── animals.ts                # CRUD animaux
    │   │   ├── health.ts                 # Dossiers de sante
    │   │   ├── photos.ts                 # Photos animaux
    │   │   ├── boxes.ts                  # Enclos et cages
    │   │   ├── icad.ts                   # Declarations I-CAD
    │   │   ├── donations.ts              # CRUD dons + generation CERFA
    │   │   └── social-posts.ts           # Publications reseaux sociaux
    │   ├── pdf/
    │   │   ├── template.ts               # Template HTML documents
    │   │   ├── cerfa-template.ts         # Template HTML CERFA n°11580*04
    │   │   └── logo-base64.ts            # Logo fallback en base64
    │   ├── types/database.ts             # Interfaces TypeScript
    │   ├── sda-utils.ts                  # Utilitaires refuge (labels, couleurs, calculs)
    │   └── utils.ts                      # Utilitaires generaux (formatCurrency, formatDate)
    │
    └── components/
        ├── theme-provider.tsx
        ├── icons.tsx
        ├── status-badge.tsx
        ├── layout/
        │   ├── sidebar.tsx               # Navigation dynamique selon type etablissement
        │   ├── header.tsx                # Header + menu user + nav mobile
        │   └── main-content.tsx
        ├── dashboard/
        │   ├── stats-cards.tsx
        │   ├── revenue-chart.tsx         # Graphique interactif (Recharts)
        │   └── welcome-banner.tsx
        ├── documents/
        │   ├── document-list.tsx
        │   └── document-form.tsx
        ├── clients/
        │   ├── client-list.tsx
        │   ├── client-form.tsx
        │   └── client-search.tsx
        ├── animals/
        │   ├── animal-list.tsx
        │   ├── animal-form.tsx
        │   ├── animal-detail-tabs.tsx    # 6 onglets (Infos, Photos, Sante, Mouvements, Publications, I-CAD)
        │   ├── animal-info-tab.tsx
        │   ├── animal-photos-tab.tsx
        │   ├── animal-status-badge.tsx
        │   ├── movements-tab.tsx
        │   └── health-tab.tsx
        ├── health/
        │   └── health-record-form.tsx
        ├── icad/
        │   ├── icad-declarations.tsx     # Composant fiche animal
        │   └── icad-action-buttons.tsx   # Boutons changement de statut
        ├── donations/
        │   ├── donation-list.tsx
        │   └── donation-form.tsx
        ├── social/
        │   └── post-generator.tsx        # Generateur IA 3 etapes
        ├── establishment/
        │   ├── establishment-switcher.tsx
        │   ├── establishment-form.tsx
        │   ├── logo-upload.tsx
        │   ├── members-list.tsx
        │   ├── pending-users-list.tsx
        │   ├── invite-member-search.tsx
        │   ├── waiting-page.tsx
        │   ├── add-member-form.tsx
        │   └── setup-form.tsx
        └── account/
            ├── account-form.tsx
            ├── avatar-upload.tsx
            └── password-form.tsx
```

---

## Base de donnees

### Tables

| Table | Description |
|-------|-------------|
| `establishments` | Etablissements (nom, type, adresse, IBAN, BIC, logo) |
| `establishment_members` | Membres avec role et 12 permissions booleennes |
| `documents` | Devis, factures, avoirs (JSONB pour les lignes) |
| `clients` | Repertoire clients (particuliers, organisations) |
| `animals` | Fiches animaux (espece, race, puce, statut, origine) |
| `animal_photos` | Photos avec flag `is_primary` |
| `animal_movements` | Historique des mouvements (adoption, transfert, etc.) |
| `animal_health_records` | Dossiers de sante (vaccins, chirurgies, etc.) |
| `boxes` | Enclos et cages (espece, capacite) |
| `icad_declarations` | Declarations I-CAD (10 types, 6 statuts) |
| `donations` | Dons avec numerotation CERFA automatique |
| `social_posts` | Publications reseaux sociaux |

### Fonctions PostgreSQL

| Fonction | Description |
|----------|-------------|
| `get_next_document_number(type, est_id)` | Numero suivant scope par etablissement |
| `get_next_cerfa_number(est_id, year)` | Numero CERFA suivant scope par etablissement et annee |
| `user_establishment_ids()` | `SECURITY DEFINER` — IDs d'etablissements de l'utilisateur |
| `get_user_id_by_email(email)` | `SECURITY DEFINER` — Lookup utilisateur |
| `get_users_info(user_ids)` | `SECURITY DEFINER` — Retourne email, nom et avatar |
| `get_unassigned_users()` | `SECURITY DEFINER` — Users sans etablissement |

### Buckets Storage

| Bucket | Contenu |
|--------|---------|
| `logos` | Logos d'etablissements |
| `avatars` | Avatars utilisateurs |
| `animal-photos` | Photos d'animaux |

---

## Pages

| URL | Description | Permission |
|-----|-------------|------------|
| `/login` | Connexion email/mdp + Google | Public |
| `/setup` | Page d'attente (validation admin) | Authentifie, sans etablissement |
| `/dashboard` | Statistiques et graphique CA | Membre |
| `/documents` | Liste des documents | `canManageDocuments` |
| `/documents/nouveau` | Creer un document | `canManageDocuments` |
| `/documents/[id]/edit` | Modifier un document | `canManageDocuments` |
| `/clients` | Liste des clients | `canManageClients` |
| `/clients/nouveau` | Creer un client | `canManageClients` |
| `/clients/[id]` | Fiche client | `canManageClients` |
| `/animals` | Liste des animaux | `canViewAnimals` |
| `/animals/nouveau` | Creer un animal | `canManageAnimals` |
| `/animals/[id]` | Detail animal (6 onglets) | `canViewAnimals` |
| `/health` | Dossiers de sante | `canManageHealth` |
| `/pound` | Fourriere | `canViewPound` |
| `/boxes` | Enclos et cages | `canManageBoxes` |
| `/icad` | Declarations I-CAD | `canManageMovements` |
| `/donations` | Liste des dons + stats | `canManageDonations` |
| `/donations/nouveau` | Creer/editer un don | `canManageDonations` |
| `/etablissement` | Admin etablissement + membres | `canManageEstablishment` |
| `/compte` | Profil, avatar, email, mot de passe | Authentifie |
| `/api/pdf/[id]` | Generation PDF document | Authentifie |
| `/api/pdf/cerfa/[id]` | Generation PDF CERFA | Authentifie |
| `/api/ai/generate-post` | Generation de post IA | Authentifie |

---

## Flux d'authentification

```
Utilisateur → Page quelconque
       ↓
  middleware.ts → Supabase getUser()
       ↓
  Non authentifie?  →  Redirect /login
  Authentifie?      →  (app)/layout.tsx
       ↓
  getUserEstablishments()
       ↓
  0 etablissements?  →  Redirect /setup
  >= 1?              →  getEstablishmentContext() → Page demandee
```

---

## Commandes

| Commande | Description |
|----------|-------------|
| `npm run dev` | Mode developpement avec Turbopack |
| `npm run build` | Build de production |
| `npm start` | Lancer le build |
| `npm run lint` | Verifier le code avec ESLint |

---

## Deploiement Docker (Coolify)

L'application est deployee via **Coolify** sur un VPS avec un Dockerfile multi-stage.

### Variables d'environnement

**Build arguments** (necessaires au build Next.js) :

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cle anonyme Supabase |

**Variables runtime** (injectees dans le conteneur) :

| Variable | Description |
|----------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Cle admin Supabase (server-side only) |
| `ANTHROPIC_API_KEY` | Cle API Claude (generation IA) |

### Build et lancement

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-anon-key \
  -t optimus .

docker run -p 3000:3000 \
  -e SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key \
  -e ANTHROPIC_API_KEY=votre-cle-anthropic \
  optimus
```

### Dockerfile

3 stages :

1. **deps** (`node:20-alpine`) — `npm ci` avec `PUPPETEER_SKIP_DOWNLOAD=true`
2. **builder** (`node:20-alpine`) — `npm run build` (standalone output)
3. **runner** (`node:20-slim`) — Image de production avec Google Chrome Stable pour Puppeteer

Points importants :
- **Google Chrome Stable** installe depuis le depot officiel Google (apt) pour la generation PDF
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable`
- `ENV HOME=/tmp` pour l'utilisateur non-root `nextjs`
- Le `node_modules` complet est copie pour les dependances transitives de Puppeteer

### Domaine personnalise

Ajouter l'URL de redirection dans Supabase > Authentication > URL Configuration > Redirect URLs :
- Exemple : `https://crm.skyclem.fr/auth/callback`

---

## Notes techniques

### Server Components et RLS

`createClient()` (cookie-based) echoue silencieusement pour les ecritures (`setAll`) dans les Server Components. Toutes les **lectures de donnees** dans les pages serveur utilisent `createAdminClient()` (service_role key, bypass RLS). `createClient()` reste utilise pour `getUser()` et dans les Server Actions.

### Documents avec statut `converted`

Les devis convertis en facture passent en statut `converted`. Ils sont masques dans toutes les listes avec `.neq('status', 'converted')`.

### Donnees de test

Scripts SQL dans `scripts/` pour peupler un etablissement avec des donnees realistes. A executer dans Supabase SQL Editor, **dans l'ordre** :

1. **`01-seed-clients.sql`** — 40 clients (20 particuliers + 20 organisations, region Nord)
2. **`02-seed-devis.sql`** — 15 devis (5 draft, 6 sent, 4 cancelled)
3. **`03-seed-factures.sql`** — 40 factures + 1 avoir

> **Important** : La contrainte `documents_numero_key` est **GLOBALE** (pas par etablissement). Les donnees de test utilisent la plage 100+ pour eviter les conflits.

---

## Licence

Projet prive - Tous droits reserves.
