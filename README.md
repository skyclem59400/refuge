# CRM La Ferme O 4 Vents

Application de gestion de factures, devis et clients pour **La Ferme O 4 Vents** (refuge pour animaux).

---

## Demarrage rapide

### Prerequis

- **Node.js** 18+ installe
- Un compte **Supabase** avec la base de donnees configuree (tables `clients`, `documents`, `settings`)
- Un utilisateur cree dans Supabase Auth (email/mot de passe)

### Installation

```bash
cd crm-ferme
npm install
```

### Configuration

Le fichier `.env.local` a la racine du projet contient les credentials Supabase :

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
```

### Lancer l'application

```bash
npm run dev
```

Ouvrir **http://localhost:3000** dans le navigateur.

Se connecter avec l'email et le mot de passe de l'utilisateur Supabase.

### Build de production

```bash
npm run build
npm start
```

---

## Fonctionnalites

### Authentification

- Connexion par email/mot de passe via Supabase Auth
- Session geree par cookies (compatible Server Components)
- Middleware de protection : toutes les pages sauf `/login` necessitent une authentification
- Deconnexion depuis le menu utilisateur en haut a droite

### Dashboard

- Message d'accueil personnalise selon l'heure (Bonjour / Bon apres-midi / Bonsoir)
- Statistiques en temps reel :
  - Nombre total de documents, devis, factures, clients
  - Chiffre d'affaires (factures payees)
  - Montant en attente (factures envoyees)
- Liste des 5 documents les plus recents

### Gestion des documents

**Creation** (`/documents/nouveau`) :
- Choix du type : devis ou facture
- Recherche client par nom ou email (autocomplete)
- Saisie du nombre d'adultes + prix unitaire
- Saisie du nombre d'enfants + prix unitaire
- Calcul automatique du total en temps reel
- Champ notes libre
- Apercu en direct du document (colonne droite)
- Numerotation automatique : `D-2026-001` pour les devis, `F-2026-001` pour les factures

**Liste** (`/documents`) :
- Tableau avec colonnes : Type, Numero, Date, Client, Total, Statut, Actions
- Filtres par type (devis/facture) et par statut (brouillon/envoye/paye/annule)
- Changement de statut directement depuis le tableau
- Actions par document :
  - **PDF** : genere et ouvre le PDF dans un nouvel onglet
  - **Convertir** : transforme un devis en facture (copie toutes les donnees, nouveau numero)
  - **Supprimer** : suppression avec confirmation

**Conversion devis vers facture** :
- Cree une nouvelle facture avec un numero `F-YYYY-XXX`
- Copie toutes les donnees du devis (client, montants, notes)
- Etablit le lien entre le devis et la facture (`converted_from_id` / `converted_to_id`)
- Le bouton "Convertir" disparait une fois le devis converti

### Gestion des clients

**Liste** (`/clients`) :
- Tableau avec colonnes : Nom, Email, Telephone, Ville, Type, Actions
- Recherche en temps reel par nom, email ou ville
- Actions : voir la fiche detail, supprimer

**Creation** (`/clients/nouveau`) :
- Formulaire : nom (obligatoire), email, telephone, adresse, code postal, ville, type (particulier/organisation), notes

**Fiche client** (`/clients/[id]`) :
- Informations de contact completes
- Statistiques : nombre de documents, chiffre d'affaires paye
- Historique complet des documents lies a ce client
- Formulaire de modification (accordeon)

**Protection** :
- Un client avec des documents associes ne peut pas etre supprime (contrainte de cle etrangere)

### Generation PDF

- Route API : `GET /api/pdf/[documentId]`
- Template HTML fidele au design violet/gradient de la Ferme O 4 Vents :
  - En-tete avec gradient violet (#667eea vers #764ba2) et logo emoji
  - Sections informations document et client
  - Tableau des prestations (adultes/enfants)
  - Section total avec mention "TVA non applicable - Article 293 B du CGI"
  - Notes conditionnelles
  - Pied de page avec coordonnees
- Generation via Puppeteer (rendu pixel-perfect du HTML/CSS)
- Le PDF s'ouvre dans un nouvel onglet du navigateur

---

## Architecture technique

### Stack

| Technologie | Role |
|-------------|------|
| Next.js 16 (App Router) | Framework fullstack |
| TypeScript | Typage |
| Tailwind CSS v4 | Styles |
| Supabase | Base de donnees PostgreSQL, authentification, RLS |
| Puppeteer | Generation PDF cote serveur |
| Sonner | Notifications toast |

### Structure du projet

```
crm-ferme/
├── middleware.ts                     # Garde d'authentification
├── .env.local                        # Variables d'environnement Supabase
│
└── src/
    ├── app/
    │   ├── layout.tsx                # Layout racine (font Inter, Toaster)
    │   ├── globals.css               # Theme dark + utilitaires CSS
    │   ├── page.tsx                  # Redirection vers /dashboard
    │   ├── login/page.tsx            # Page de connexion
    │   │
    │   ├── (app)/                    # Groupe de routes authentifiees
    │   │   ├── layout.tsx            # Layout avec sidebar + header
    │   │   ├── dashboard/page.tsx    # Dashboard statistiques
    │   │   ├── documents/
    │   │   │   ├── page.tsx          # Liste des documents
    │   │   │   └── nouveau/page.tsx  # Creation de document
    │   │   └── clients/
    │   │       ├── page.tsx          # Liste des clients
    │   │       ├── nouveau/page.tsx  # Creation de client
    │   │       └── [id]/page.tsx     # Fiche client
    │   │
    │   └── api/pdf/[documentId]/
    │       └── route.ts              # API generation PDF
    │
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts             # Client Supabase navigateur
    │   │   ├── server.ts             # Client Supabase serveur
    │   │   └── middleware.ts         # Client Supabase middleware
    │   ├── actions/
    │   │   ├── documents.ts          # Server Actions documents
    │   │   └── clients.ts            # Server Actions clients
    │   ├── pdf/template.ts           # Template HTML pour les PDFs
    │   ├── types/database.ts         # Types TypeScript
    │   └── utils.ts                  # Fonctions utilitaires
    │
    └── components/
        ├── layout/
        │   ├── sidebar.tsx           # Navigation laterale
        │   └── header.tsx            # Barre superieure + menu utilisateur
        ├── dashboard/
        │   ├── stats-cards.tsx       # Cartes de statistiques
        │   └── welcome-banner.tsx    # Banniere d'accueil
        ├── documents/
        │   ├── document-list.tsx     # Tableau + filtres
        │   ├── document-form.tsx     # Formulaire + apercu
        │   └── status-badge.tsx      # Badges type/statut
        └── clients/
            ├── client-list.tsx       # Tableau + recherche
            ├── client-form.tsx       # Formulaire creation/edition
            └── client-search.tsx     # Autocomplete recherche
```

### Flux d'authentification

```
Utilisateur → Page quelconque
       ↓
  middleware.ts
       ↓
  Supabase: getUser() (verifie le JWT dans les cookies)
       ↓
  Non authentifie?  →  Redirection /login
  Authentifie?      →  Page demandee
```

1. L'utilisateur accede a n'importe quelle page
2. Le middleware intercepte la requete
3. Supabase verifie le token JWT dans les cookies
4. Si non authentifie : redirection vers `/login`
5. Si authentifie et sur `/login` : redirection vers `/dashboard`
6. La connexion utilise `signInWithPassword()` de Supabase Auth
7. Les cookies de session sont geres automatiquement par `@supabase/ssr`

### Server Actions

Les mutations (creation, modification, suppression) passent par des **Server Actions** Next.js :

| Action | Fichier | Description |
|--------|---------|-------------|
| `createDocument()` | `actions/documents.ts` | Appelle `rpc('get_next_document_number')` puis insere le document |
| `deleteDocument()` | `actions/documents.ts` | Supprime un document par ID |
| `convertDevisToFacture()` | `actions/documents.ts` | Cree une facture a partir d'un devis, etablit les liens |
| `updateDocumentStatus()` | `actions/documents.ts` | Change le statut (brouillon/envoye/paye/annule) |
| `createClientAction()` | `actions/clients.ts` | Cree un nouveau client |
| `updateClientAction()` | `actions/clients.ts` | Modifie un client existant |
| `deleteClientAction()` | `actions/clients.ts` | Supprime un client (echoue si documents lies) |

Chaque action appelle `revalidatePath()` pour rafraichir les donnees cote serveur.

### Base de donnees Supabase

**Tables** :

| Table | Description |
|-------|-------------|
| `clients` | id, name, email, phone, address, postal_code, city, type, notes |
| `documents` | id, type, numero, date, client_id, client_name (snapshot), nb_adultes, prix_adulte, nb_enfants, prix_enfant, total, notes, status, converted_from_id, converted_to_id, pdf_url |
| `settings` | key, value (JSONB) — compteurs de numerotation et infos entreprise |

**Fonction PostgreSQL** :
- `get_next_document_number(doc_type)` : retourne le prochain numero (`F-2026-001` ou `D-2026-001`), incremente le compteur dans `settings`, gere le changement d'annee automatiquement

**RLS (Row Level Security)** :
- Toutes les tables sont protegees
- Seuls les utilisateurs authentifies ont acces en lecture et ecriture

### Theme et design

| Element | Valeur |
|---------|--------|
| Mode | Dark par defaut |
| Couleur primaire | `#6366f1` (indigo) |
| Couleur secondaire | `#8b5cf6` (violet) |
| Couleur accent | `#ec4899` (rose) |
| Fond principal | `#0f172a` |
| Fond cartes | `#1e293b` |
| Fond survol | `#334155` |
| Police | Inter |

Effets : ombres luminescentes (glow), transitions fluides, animations fadeUp, badges colores par statut.

Responsive : sidebar masquee sur mobile avec navigation hamburger.

---

## Schema de la base de donnees

Pour initialiser la base Supabase, executer le script SQL :

```
ferme-factures/database/supabase-schema.sql
```

Ce script cree :
- Les 3 tables (clients, documents, settings)
- Les index de performance
- La fonction `get_next_document_number()`
- Les triggers `updated_at`
- Les policies RLS
- Les vues `documents_with_client` et `stats_overview`
- Des donnees de test (3 clients)

---

## Pages de l'application

| URL | Page | Type |
|-----|------|------|
| `/` | Redirection vers `/dashboard` | Statique |
| `/login` | Connexion | Client Component |
| `/dashboard` | Dashboard avec statistiques | Server Component |
| `/documents` | Liste des documents | Server + Client |
| `/documents/nouveau` | Formulaire de creation | Client Component |
| `/clients` | Liste des clients | Server + Client |
| `/clients/nouveau` | Formulaire de creation client | Client Component |
| `/clients/[id]` | Fiche client detaillee | Server Component |
| `/api/pdf/[id]` | Generation PDF | API Route |

---

## Commandes

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lancer en mode developpement (http://localhost:3000) |
| `npm run build` | Compiler pour la production |
| `npm start` | Lancer le build de production |
| `npm run lint` | Verifier le code avec ESLint |
