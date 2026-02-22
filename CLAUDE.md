# CLAUDE.md - Optimus (Logiciel de refuge)

## Projet

Application de gestion pour **La Ferme O 4 Vents** (refuge pour animaux, region Nord).
Nom interne : **Optimus**.

- **Stack** : Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Supabase (PostgreSQL, Auth, Storage) + Puppeteer (PDF) + Recharts (graphiques)
- **Deploiement** : Docker multi-stage via Coolify sur VPS, auto-deploy sur push main
- **Repo** : `https://github.com/skyclem59400/refuge.git`
- **Admin principal** : `clement.scailteux@gmail.com`
- **URL prod** : `https://crm.skyclem.fr`
- **Supabase** : `https://zzevrtrgtgnlxxuwbnge.supabase.co`

## Commandes

```bash
npm run dev      # Dev local (http://localhost:3000)
npm run build    # Build production
npm start        # Lancer le build
npm run lint     # ESLint
```

## Architecture

```
refuge/
├── middleware.ts                      # Auth : redirige /login si non connecte
├── next.config.ts                     # output: standalone, puppeteer external
├── Dockerfile                         # 3 stages: deps → builder → runner (Chrome pour PDF)
├── scripts/                           # Scripts SQL seed (donnees de test)
│   ├── 01-seed-clients.sql            # 40 clients pour etablissement "Test"
│   ├── 02-seed-devis.sql              # 15 devis
│   ├── 03-seed-factures.sql           # 40 factures + 1 avoir
│   └── seed-test-data.sql             # OBSOLETE (remplace par les 3 scripts ci-dessus)
│
└── src/
    ├── app/
    │   ├── globals.css                # Theme light/dark via @theme CSS vars
    │   ├── login/page.tsx             # Google SSO (principal) + email/mdp (cache)
    │   ├── setup/page.tsx             # Page d'attente pour users sans etablissement
    │   ├── auth/callback/route.ts     # OAuth callback
    │   ├── api/pdf/[documentId]/      # Generation PDF via Puppeteer
    │   └── (app)/                     # Routes authentifiees (layout avec sidebar)
    │       ├── dashboard/page.tsx     # Stats + graphique CA + documents recents
    │       ├── documents/             # Liste, nouveau, [id]/edit
    │       ├── clients/               # Liste, nouveau, [id]
    │       ├── etablissement/page.tsx # Admin : infos, membres, users en attente
    │       └── compte/page.tsx        # Profil, avatar, email, mdp
    │
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts              # createClient() — navigateur
    │   │   ├── server.ts              # createClient() (cookie SSR) + createAdminClient() (service_role)
    │   │   └── middleware.ts          # updateSession()
    │   ├── establishment/
    │   │   ├── context.ts             # getEstablishmentContext(), getUserEstablishments()
    │   │   └── permissions.ts         # requirePermission(), requireEstablishment()
    │   ├── actions/
    │   │   ├── documents.ts           # CRUD + conversion devis→facture + annulation→avoir
    │   │   ├── clients.ts             # CRUD + searchClients()
    │   │   ├── establishments.ts      # CRUD + membres + getUnassignedUsers() + addPendingUser()
    │   │   ├── account.ts             # Profil, email, mdp
    │   │   └── switch-establishment.ts
    │   ├── pdf/                       # Template HTML + logo fallback base64
    │   ├── types/database.ts          # Interfaces TypeScript
    │   └── utils.ts                   # formatCurrency, formatDateShort, etc.
    │
    └── components/
        ├── dashboard/
        │   ├── welcome-banner.tsx     # Banniere de bienvenue personnalisee
        │   ├── stats-cards.tsx        # Cartes KPI (documents, devis, factures, clients, CA)
        │   └── revenue-chart.tsx      # Graphique CA : courbe/histogramme, echelle jour/semaine/mois, legende interactive
        └── ...                        # Autres composants (document-form, client-list, etc.)
```

## Base de donnees

### Tables

| Table | Description |
|-------|-------------|
| `establishments` | Etablissements (nom, raison sociale, adresse, IBAN, BIC, logo_url) |
| `establishment_members` | user_id + establishment_id + role (admin/member) + permissions booleans |
| `documents` | Devis, factures, avoirs — scopes par `establishment_id` |
| `clients` | Clients — scopes par `establishment_id` |

### Types et statuts

```
DocumentType:   'devis' | 'facture' | 'avoir'
DocumentStatus: 'draft' | 'sent' | 'paid' | 'cancelled' | 'converted' | 'validated'
ClientType:     'particulier' | 'organisation'
```

- `converted` = devis converti en facture, **masque dans les listes** (`.neq('status', 'converted')`)
- `validated` = statut des avoirs
- `cancelled` = facture annulee par un avoir

### Contraintes importantes

- **`documents_numero_key`** : contrainte UNIQUE **GLOBALE** (pas par etablissement). Les numeros de documents doivent etre uniques sur TOUTE la base.
- Format numeros : `PREFIX-ANNEE-SEQUENCE` (ex: `F-2026-001`, `D-2026-001`, `A-2026-001`)
- Les donnees de test utilisent la **plage 100+** (F-2025-101, D-2026-101) pour eviter les conflits avec l'etablissement reel.
- Numerotation automatique via `get_next_document_number(type, est_id)`

### Fonctions PostgreSQL (SECURITY DEFINER)

| Fonction | Description |
|----------|-------------|
| `get_next_document_number(type, est_id)` | Numero auto-increment scope par etablissement |
| `user_establishment_ids()` | IDs d'etablissements de l'user (evite recursion RLS) |
| `get_user_id_by_email(email)` | Lookup utilisateur pour ajout membre |
| `get_users_info(user_ids)` | Email, nom, avatar depuis auth.users |
| `get_unassigned_users()` | Users sans etablissement (pour page admin) |

### Storage (buckets Supabase)

- `logos` — logos d'etablissements (public)
- `avatars` — avatars utilisateurs (public)

## Authentification et permissions

### Flux de connexion

1. **Google SSO** = bouton principal sur `/login`
2. **Email/mot de passe** = cache derriere lien "Connexion administrateur"
3. Nouvel utilisateur Google → redirige vers `/setup` → **page d'attente** ("En attente de validation")
4. L'admin voit les **utilisateurs en attente** dans `/etablissement` et les ajoute manuellement
5. Seul `clement.scailteux@gmail.com` peut creer un etablissement

### Securite 3 niveaux

1. **RLS PostgreSQL** — filtrage au niveau base de donnees
2. **`requirePermission()`** — verification dans les Server Actions
3. **UI conditionnelle** — masquage des boutons sans permission

### Permissions

| Permission | Portee |
|------------|--------|
| `manage_documents` | CRUD documents (devis, factures, avoirs) |
| `manage_clients` | CRUD clients |
| `manage_establishment` | Infos etablissement + gestion membres |

### Probleme connu : RLS et cookies en Server Components

**`createClient()`** (cookie-based) echoue silencieusement pour les **ecritures** (`setAll`) dans les Server Components.
Solution : toutes les **lectures de donnees** dans les pages serveur utilisent **`createAdminClient()`** (service_role key, bypass RLS).
`createClient()` reste utilise pour `getUser()` et dans les Server Actions.

## Donnees de test

Etablissement de test : **"Test"** (doit exister dans la table `establishments`).

### Scripts SQL (a executer dans Supabase SQL Editor, dans l'ordre)

1. **`scripts/01-seed-clients.sql`** — 40 clients (20 particuliers + 20 organisations, region Nord). Nettoie les donnees existantes de l'etablissement "Test" avant insertion.
2. **`scripts/02-seed-devis.sql`** — 15 devis (5 draft, 6 sent, 4 cancelled). Numerotation D-2026-101 a D-2026-115.
3. **`scripts/03-seed-factures.sql`** — 40 factures + 1 avoir. Numerotation F-2025-101 a F-2026-128, A-2025-101.

**Tous executes et confirmes fonctionnels.**

### Repartition des factures

| Mois | Factures | CA paye | CA en attente |
|------|----------|---------|---------------|
| Dec 2025 | 12 (toutes payees) | 2 075 EUR | — |
| Jan 2026 | 15 (13 payees, 2 envoyees) | 2 808 EUR | 348 EUR |
| Fev 2026 | 13 (10 payees, 3 envoyees) | 2 435 EUR | 1 240 EUR |

Plus 1 avoir (A-2025-101) sur F-2025-108 (Association Durand, 220 EUR).

### Note sur `seed-test-data.sql`

Ce fichier est **OBSOLETE**. Il a ete remplace par les 3 scripts sequentiels ci-dessus. Ne pas l'utiliser (numerotation partiellement mise a jour, bugs restants).

## Deploiement

- **Plateforme** : Coolify (Docker) sur VPS
- **Auto-deploy** : push sur `main` declenche le build
- **Dockerfile** : 3 stages (deps → builder → runner avec Google Chrome pour Puppeteer)
- **Variables d'environnement** (Coolify) :
  - `NEXT_PUBLIC_SUPABASE_URL` (build + runtime)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (build + runtime)
  - `SUPABASE_SERVICE_ROLE_KEY` (runtime seulement)
- **Redirect URL** Supabase Auth : `https://crm.skyclem.fr/auth/callback`

## Git

```
Remote: https://github.com/skyclem59400/refuge.git
Branch: main
user.name: skyclem59400
user.email: c.scailteux@sda-nord.com
```

## Fonctionnalites implementees

- [x] Authentification email/mdp + Google SSO
- [x] Multi-etablissement avec switcher
- [x] Permissions granulaires (admin/member + 3 permissions)
- [x] Dashboard avec stats (CA paye, en attente, nb documents, nb clients)
- [x] Graphique d'evolution du CA (courbe/histogramme, echelle jour/semaine/mois, legende cliquable)
- [x] CRUD documents (devis, factures, avoirs)
- [x] Conversion devis → facture
- [x] Annulation facture → creation avoir automatique
- [x] Numerotation automatique
- [x] Generation PDF (Puppeteer + Chrome)
- [x] CRUD clients avec recherche autocomplete
- [x] Fiche client avec historique documents
- [x] Gestion membres (ajout, permissions, suppression)
- [x] Page d'attente pour nouveaux utilisateurs Google
- [x] Utilisateurs en attente visibles par l'admin
- [x] Invitation d'utilisateurs existants
- [x] Upload logo etablissement + avatar utilisateur
- [x] Theme clair/sombre avec persistance
- [x] Donnees de test (40 clients, 15 devis, 40 factures, 1 avoir)

## Methode de travail

### Skills disponibles
Avant toute tache complexe, consulte les skills dans `~/.gemini/antigravity/scratch/skills/superpowers/`. Lis le SKILL.md correspondant avant d'agir.

### Agents paralleles
Pour toute tache touchant **2+ fichiers independants**, utilise le pattern de dispatching d'agents paralleles (Task tool) :
- Un agent par fichier/domaine independant
- Prompt specifique avec contexte, contraintes et output attendu
- Review + build de verification apres integration

### Workflow type pour une feature
1. Creer une branche `feature/nom`
2. Si complexe : `writing-plans` → plan d'implementation
3. Dispatcher les agents en parallele sur les sous-taches independantes
4. Integrer, verifier le build (`npm run build`)
5. Merge sur `main` et push (auto-deploy Coolify)

## Idees / TODO potentiel

- [ ] Export CSV des documents/clients
- [ ] Envoi d'email de facture au client
- [ ] Relances automatiques pour factures impayees
