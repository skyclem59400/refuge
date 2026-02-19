# CRM La Ferme O 4 Vents

Application de gestion de factures, devis et clients pour **La Ferme O 4 Vents** (refuge pour animaux).

Multi-etablissement, permissions granulaires, theme clair/sombre.

---

## Demarrage rapide

### Prerequis

- **Node.js** 20+ installe
- Un compte **Supabase** avec la base de donnees configuree

### Installation

```bash
cd crm-ferme
npm install
```

### Configuration

Creer un fichier `.env.local` a la racine :

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
```

### Base de donnees

Executer les migrations SQL dans l'editeur SQL de Supabase (Dashboard > SQL Editor). Le schema complet est documente dans la section [Base de donnees](#base-de-donnees-1) plus bas.

Creer les buckets de stockage :

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
```

### Lancer l'application

```bash
npm run dev
```

Ouvrir **http://localhost:3000**. A la premiere connexion, l'application redirige vers `/setup` pour creer l'etablissement initial.

---

## Fonctionnalites

### Authentification

- Connexion par email/mot de passe ou Google OAuth via Supabase Auth
- Session geree par cookies (compatible Server Components)
- Middleware de protection : toutes les pages sauf `/login` necessitent une authentification

### Multi-etablissement

- Un utilisateur peut appartenir a plusieurs etablissements
- Switcher d'etablissement dans le sidebar (dropdown)
- Donnees isolees par etablissement (documents, clients)
- Cookie httpOnly `current-establishment-id` pour le contexte serveur
- Page d'onboarding `/setup` pour les nouveaux utilisateurs

### Permissions granulaires

| Role | Description |
|------|-------------|
| `admin` | Acces complet a toutes les fonctionnalites |
| `member` | Acces configurable par permission |

| Permission | Portee |
|------------|--------|
| `manage_documents` | Creer, modifier, supprimer des documents |
| `manage_clients` | Creer, modifier, supprimer des clients |
| `manage_establishment` | Editer les infos de l'etablissement, gerer les membres |

Securite a 3 niveaux :
1. **RLS PostgreSQL** — filtrage au niveau de la base
2. **`requirePermission()`** — verification dans les Server Actions
3. **UI conditionnelle** — masquage des boutons sans permission

### Dashboard

- Statistiques en temps reel (documents, CA paye, montant en attente)
- 5 documents les plus recents
- Donnees scopees par etablissement

### Documents

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

- Fiche client avec informations de contact
- Statistiques par client (documents, CA)
- Historique des documents lies
- Recherche en temps reel
- Protection contre la suppression si documents lies

### Generation PDF

- Route API : `GET /api/pdf/[documentId]`
- Logo dynamique de l'etablissement (fetch + conversion base64)
- Infos entreprise depuis la table `establishments`
- Generation via Puppeteer

### Gestion de l'etablissement (`/etablissement`)

- Edition des informations (nom, raison sociale, email, tel, adresse, IBAN, BIC)
- Upload du logo (Supabase Storage, bucket `logos`)
- Gestion des membres : ajout par email, toggles de permissions, suppression
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

## Architecture technique

### Stack

| Technologie | Role |
|-------------|------|
| Next.js 16 (App Router) | Framework fullstack |
| TypeScript | Typage |
| Tailwind CSS v4 | Styles avec variables CSS `@theme` |
| Supabase | PostgreSQL, Auth, Storage, RLS |
| Puppeteer | Generation PDF cote serveur |
| Sonner | Notifications toast |

### Structure du projet

```
crm-ferme/
├── Dockerfile                       # Multi-stage Docker build
├── .dockerignore
├── middleware.ts
├── next.config.ts
├── .env.local
│
└── src/
    ├── app/
    │   ├── layout.tsx                    # Layout racine + ThemeProvider
    │   ├── globals.css                   # Variables theme light/dark
    │   ├── page.tsx                      # Redirect → /dashboard
    │   ├── login/page.tsx                # Connexion (email + Google)
    │   │
    │   ├── setup/page.tsx                # Onboarding (1er etablissement)
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
    │   │   ├── etablissement/page.tsx    # Admin etablissement
    │   │   └── compte/page.tsx           # Compte utilisateur
    │   │
    │   ├── api/pdf/[documentId]/route.ts
    │   └── auth/callback/route.ts        # Callback OAuth
    │
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts                 # Client navigateur
    │   │   ├── server.ts                 # Client serveur
    │   │   └── middleware.ts
    │   ├── establishment/
    │   │   ├── context.ts                # getEstablishmentContext(), getUserEstablishments()
    │   │   └── permissions.ts            # requirePermission(), requireEstablishment()
    │   ├── actions/
    │   │   ├── documents.ts              # CRUD documents (scoped)
    │   │   ├── clients.ts                # CRUD clients (scoped)
    │   │   ├── establishments.ts         # CRUD etablissement + membres
    │   │   ├── switch-establishment.ts   # Changement d'etablissement (cookie)
    │   │   └── account.ts                # Profil, email, mot de passe
    │   ├── pdf/
    │   │   ├── template.ts               # Template HTML PDF
    │   │   └── logo-base64.ts            # Logo fallback en base64
    │   ├── types/database.ts             # Types TypeScript
    │   └── utils.ts
    │
    └── components/
        ├── theme-provider.tsx
        ├── icons.tsx
        ├── layout/
        │   ├── sidebar.tsx               # Navigation + switcher etablissement
        │   ├── header.tsx                # Header + menu user + nav mobile
        │   └── main-content.tsx
        ├── dashboard/
        │   ├── stats-cards.tsx
        │   └── welcome-banner.tsx
        ├── documents/
        │   ├── document-list.tsx
        │   ├── document-form.tsx
        │   └── status-badge.tsx
        ├── clients/
        │   ├── client-list.tsx
        │   ├── client-form.tsx
        │   └── client-search.tsx
        ├── establishment/
        │   ├── establishment-switcher.tsx
        │   ├── establishment-form.tsx
        │   ├── logo-upload.tsx
        │   ├── members-list.tsx
        │   ├── add-member-form.tsx
        │   └── setup-form.tsx
        └── account/
            ├── account-form.tsx
            ├── avatar-upload.tsx
            └── password-form.tsx
```

### Base de donnees

| Table | Description |
|-------|-------------|
| `establishments` | Etablissements (nom, adresse, IBAN, BIC, logo_url, etc.) |
| `establishment_members` | Liens utilisateur-etablissement avec role et permissions |
| `documents` | Documents scopes par `establishment_id` |
| `clients` | Clients scopes par `establishment_id` |

| Fonction PostgreSQL | Description |
|---------------------|-------------|
| `get_next_document_number(type, est_id)` | Numero suivant scope par etablissement |
| `user_establishment_ids()` | `SECURITY DEFINER` — IDs d'etablissements de l'utilisateur (evite les references circulaires RLS) |
| `get_user_id_by_email(email)` | `SECURITY DEFINER` — Lookup utilisateur pour ajout de membres |
| `get_users_info(user_ids)` | `SECURITY DEFINER` — Retourne email, nom et avatar des utilisateurs |

| Bucket Storage | Contenu |
|----------------|---------|
| `logos` | Logos d'etablissements |
| `avatars` | Avatars utilisateurs |

### Flux d'authentification

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

### Server Actions

| Action | Fichier | Permission requise |
|--------|---------|--------------------|
| `createDocument()` | `actions/documents.ts` | `manage_documents` |
| `updateDocument()` | `actions/documents.ts` | `manage_documents` |
| `deleteDocument()` | `actions/documents.ts` | `manage_documents` |
| `convertDevisToFacture()` | `actions/documents.ts` | `manage_documents` |
| `cancelFactureWithAvoir()` | `actions/documents.ts` | `manage_documents` |
| `createClientAction()` | `actions/clients.ts` | `manage_clients` |
| `updateClientAction()` | `actions/clients.ts` | `manage_clients` |
| `deleteClientAction()` | `actions/clients.ts` | `manage_clients` |
| `updateEstablishment()` | `actions/establishments.ts` | `manage_establishment` |
| `addMember()` | `actions/establishments.ts` | `manage_establishment` |
| `updateMemberPermissions()` | `actions/establishments.ts` | `manage_establishment` |
| `removeMember()` | `actions/establishments.ts` | `manage_establishment` |
| `updateProfile()` | `actions/account.ts` | Authentifie |
| `updateEmail()` | `actions/account.ts` | Authentifie |
| `updatePassword()` | `actions/account.ts` | Authentifie |

---

## Pages

| URL | Description | Acces |
|-----|-------------|-------|
| `/login` | Connexion email/mdp + Google | Public |
| `/setup` | Creation du premier etablissement | Authentifie, sans etablissement |
| `/dashboard` | Statistiques et documents recents | Membre |
| `/documents` | Liste des documents | Membre |
| `/documents/nouveau` | Creer un document | `manage_documents` |
| `/documents/[id]/edit` | Modifier un document | `manage_documents` |
| `/clients` | Liste des clients | Membre |
| `/clients/nouveau` | Creer un client | `manage_clients` |
| `/clients/[id]` | Fiche client | Membre |
| `/etablissement` | Admin etablissement + membres | `manage_establishment` |
| `/compte` | Profil, avatar, email, mot de passe | Authentifie |
| `/api/pdf/[id]` | Generation PDF | Authentifie |

---

## Commandes

| Commande | Description |
|----------|-------------|
| `npm run dev` | Mode developpement (http://localhost:3000) |
| `npm run build` | Build de production |
| `npm start` | Lancer le build |
| `npm run lint` | Verifier le code avec ESLint |

---

## Deploiement Docker (Coolify)

L'application est deployee via **Coolify** sur un VPS avec un Dockerfile multi-stage.

### Variables d'environnement

Configurer dans Coolify (Settings > Environment Variables) :

**Build arguments** (necessaires au build Next.js) :

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cle anonyme Supabase |

**Variables runtime** (injectees dans le conteneur) :

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cle anonyme Supabase |

### Dockerfile

Le Dockerfile utilise 3 stages :

1. **deps** (`node:20-alpine`) — `npm ci` avec `PUPPETEER_SKIP_DOWNLOAD=true`
2. **builder** (`node:20-alpine`) — `npm run build` (standalone output)
3. **runner** (`node:20-slim`) — Image de production avec Google Chrome Stable

Points importants :
- **Google Chrome Stable** est installe depuis le depot officiel Google (apt) pour la generation PDF via Puppeteer
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable` pointe Puppeteer vers Chrome
- `ENV HOME=/tmp` donne un repertoire home inscriptible a l'utilisateur non-root `nextjs`
- `--user-data-dir=/tmp/chrome-data` dans les args Chrome fournit un repertoire pour le crash handler
- Le `node_modules` complet est copie pour les dependances transitives de Puppeteer

### Domaine personnalise

Lors de l'utilisation d'un domaine personnalise (ex: `crm.skyclem.fr`) :
- Ajouter l'URL de redirection dans Supabase > Authentication > URL Configuration > Redirect URLs
- Exemple : `https://crm.skyclem.fr/auth/callback`
