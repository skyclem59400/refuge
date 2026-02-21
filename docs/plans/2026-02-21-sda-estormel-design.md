# SDA Estormel - Module Refuge/Fourriere - Design

## Contexte

La SDA Estormel (ARUP) utilise actuellement HUNIMALIS pour la gestion de son refuge animalier. Le logiciel manque d'ergonomie, les donnees ne sont pas maitrisees. L'objectif est d'integrer un module complet de gestion refuge/fourriere directement dans le CRM de la Ferme O 4 Vents existant (Next.js 16 + Supabase + Tailwind CSS v4).

## Approche retenue : Module integre avec sidebar dynamique (Approche C)

La sidebar et les modules visibles s'adaptent au type d'etablissement :
- Etablissement "Ferme" → modules CRM (documents, clients)
- Etablissement "Refuge/SDA" → modules refuge (animaux, fourriere, sante, dons) + facturation
- Modules communs (facturation, clients) partages

## Priorites MVP

1. Gestion des animaux + fourriere/refuge (coeur de metier)
2. Sante / soins
3. Publication IA reseaux sociaux
4. Facturation refuge + dons / CERFA
5. Integration I-CAD

---

## 1. Modele de donnees

### Table `animals`

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | PK |
| establishment_id | UUID | FK etablissement |
| name | TEXT | Nom d'origine |
| name_secondary | TEXT | Deuxieme nom (refuge) |
| species | ENUM | chat, chien (extensible) |
| breed | TEXT | Race |
| breed_cross | TEXT | Race de croisement |
| sex | ENUM | male, female, unknown |
| birth_date | DATE | Date de naissance |
| birth_place | TEXT | Lieu de naissance |
| color | TEXT | Couleur / pelage |
| weight | DECIMAL | Poids (kg) |
| sterilized | BOOLEAN | Sterilise |
| chip_number | TEXT | N° puce |
| tattoo_number | TEXT | N° tatouage |
| tattoo_position | TEXT | Position tatouage |
| medal_number | TEXT | N° medaille |
| loof_number | TEXT | N° LOOF |
| passport_number | TEXT | N° passeport |
| icad_updated | BOOLEAN | Actualisation I-CAD faite |
| status | ENUM | pound, shelter, adopted, returned, transferred, deceased, euthanized |
| behavior_score | INT | Score comportement (1-5) |
| description | TEXT | Description / caractere |
| capture_location | TEXT | Lieu de capture/recuperation |
| capture_circumstances | TEXT | Circonstances |
| origin_type | ENUM | found, abandoned, transferred_in, surrender |
| box_id | UUID | FK box assigne |
| pound_entry_date | TIMESTAMPTZ | Date d'entree fourriere |
| shelter_entry_date | TIMESTAMPTZ | Date de passage refuge |
| exit_date | TIMESTAMPTZ | Date de sortie |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### Table `animal_photos`

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | PK |
| animal_id | UUID | FK |
| url | TEXT | URL Supabase Storage |
| is_primary | BOOLEAN | Photo principale |
| created_at | TIMESTAMPTZ | |

### Table `animal_movements`

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | PK |
| animal_id | UUID | FK |
| type | ENUM | pound_entry, shelter_transfer, adoption, return_to_owner, transfer_out, death, euthanasia |
| date | TIMESTAMPTZ | Date du mouvement |
| notes | TEXT | Commentaires |
| person_name | TEXT | Personne liee (trouveur, adoptant...) |
| person_contact | TEXT | Contact de la personne |
| destination | TEXT | Refuge destinataire si transfert |
| icad_status | ENUM | pending, declared, not_required |
| created_by | UUID | Utilisateur ayant saisi |

### Table `animal_health_records`

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | PK |
| animal_id | UUID | FK |
| type | ENUM | vaccination, sterilization, antiparasitic, consultation, surgery, medication, behavioral_assessment |
| date | TIMESTAMPTZ | |
| description | TEXT | Detail de l'acte |
| veterinarian | TEXT | Nom du veterinaire |
| next_due_date | DATE | Prochain rappel |
| cost | DECIMAL | Cout |
| notes | TEXT | |
| created_by | UUID | |

### Table `boxes`

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | PK |
| establishment_id | UUID | FK |
| name | TEXT | Nom / numero du box |
| species_type | ENUM | cat, dog, mixed |
| capacity | INT | Capacite |
| status | ENUM | available, occupied, maintenance |

### Table `donations`

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | PK |
| establishment_id | UUID | FK |
| donor_name | TEXT | Nom du donateur |
| donor_address | TEXT | Adresse complete |
| donor_email | TEXT | |
| amount | DECIMAL | Montant |
| date | DATE | Date du don |
| payment_method | TEXT | Mode de paiement |
| cerfa_number | TEXT | N° du recu fiscal |
| cerfa_generated | BOOLEAN | Recu genere |
| notes | TEXT | |

### Table `social_posts`

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | PK |
| animal_id | UUID | FK |
| type | ENUM | search_owner, adoption |
| platform | ENUM | facebook, instagram, both |
| content | TEXT | Texte genere par IA |
| photo_urls | TEXT[] | Photos utilisees |
| status | ENUM | draft, published, archived |
| published_at | TIMESTAMPTZ | |
| created_by | UUID | |

### Table `public_holidays`

| Champ | Type | Description |
|-------|------|-------------|
| date | DATE | PK |
| label | TEXT | Nom du jour ferie |

### Modification table existante `establishments`

Ajout du champ `type` : `'farm'` | `'shelter'` | `'both'`

---

## 2. Structure des pages

```
src/app/(app)/
├── dashboard/page.tsx          ← adapte selon type etablissement
│
├── animals/                    ← NOUVEAU
│   ├── page.tsx               (liste + filtres + recherche)
│   ├── nouveau/page.tsx       (formulaire creation rapide)
│   └── [id]/
│       ├── page.tsx           (fiche animal - onglets)
│       ├── health/page.tsx    (onglet sante)
│       ├── movements/page.tsx (onglet mouvements)
│       ├── photos/page.tsx    (onglet photos)
│       └── posts/page.tsx     (onglet publications)
│
├── pound/                      ← NOUVEAU
│   └── page.tsx               (vue fourriere : animaux actifs, compteur jours, alertes)
│
├── shelter/                    ← NOUVEAU
│   └── page.tsx               (vue refuge : adoptables, en soins)
│
├── boxes/                      ← NOUVEAU
│   └── page.tsx               (plan des box, assignation)
│
├── health/                     ← NOUVEAU
│   └── page.tsx               (vue globale sante : rappels, traitements en cours)
│
├── donations/                  ← NOUVEAU
│   ├── page.tsx               (liste des dons)
│   ├── nouveau/page.tsx       (saisie don)
│   └── [id]/cerfa/page.tsx    (generation recu fiscal)
│
├── posts/                      ← NOUVEAU
│   ├── page.tsx               (historique publications)
│   └── nouveau/page.tsx       (creation post IA)
│
├── documents/                  ← EXISTANT (reutilise)
├── clients/                    ← EXISTANT (reutilise)
├── etablissement/              ← EXISTANT (etendu avec config refuge)
└── compte/                     ← EXISTANT
```

### Fiche animal - Onglets

| Onglet | Contenu |
|--------|---------|
| Infos | Identite, identification (puce/tatouage/medaille), origine, description, comportement, box |
| Photos | Galerie photos, upload, definir photo principale |
| Sante | Timeline des actes, rappels, ajout rapide |
| Mouvements | Historique chronologique (entree fourriere → refuge → sortie) |
| Publications | Posts generes, brouillons, apercu |

### Dashboard refuge

- Compteurs : animaux en fourriere, en refuge, adoptions du mois
- Alertes : animaux proches des 8 jours, rappels vaccins
- Dernieres entrees

---

## 3. Permissions par profil

| Permission | Admin | Employe | Benevole | Veterinaire | Mairie |
|-----------|:-----:|:-------:|:--------:|:-----------:|:------:|
| manage_animals | ✅ | ✅ | - | - | - |
| view_animals | ✅ | ✅ | ✅ | ✅ | ✅ |
| manage_health | ✅ | ✅ | - | ✅ | - |
| manage_movements | ✅ | ✅ | - | - | - |
| manage_boxes | ✅ | ✅ | ✅ | - | - |
| manage_posts | ✅ | ✅ | - | - | - |
| manage_donations | ✅ | - | - | - | - |
| manage_documents | ✅ | - | - | - | - |
| view_pound | ✅ | ✅ | ✅ | ✅ | ✅ |
| manage_establishment | ✅ | - | - | - | - |
| view_statistics | ✅ | ✅ | - | - | ✅ |

### Roles predefinis

- **admin** → tout
- **employee** → gestion animaux, sante, mouvements, box, publications, stats
- **volunteer** → consultation animaux, assignation box
- **veterinarian** → consultation animaux, gestion sante uniquement
- **municipality** → consultation fourriere, statistiques (lecture seule)

---

## 4. Publication IA reseaux sociaux

### Deux types

1. **Recherche proprietaire (fourriere)** : photo, description physique, lieu de capture, contact refuge
2. **Adoption (refuge)** : photos, prenom, caractere, conditions d'adoption, appel a l'action

### Workflow

1. Utilisateur clique "Generer un post"
2. Choix du type (recherche proprio / adoption)
3. Selection des photos
4. IA genere le texte (API Claude) a partir de la fiche animal + commentaires equipe
5. Apercu du post
6. Modification manuelle ou regeneration possible
7. Publication sur Facebook / Instagram / les deux (Meta Graph API)

### Stack technique

- Generation texte : API Claude (Haiku ou Sonnet)
- Publication : Meta Graph API (Pages + Instagram Content Publishing)
- Photos : Supabase Storage (bucket animal-photos)
- Prompts : templates personnalisables par etablissement

---

## 5. Integration I-CAD

| Action | Detail |
|--------|--------|
| Consultation | Recherche par n° de puce a l'arrivee |
| Declaration entree | Signalement prise en charge fourriere |
| Declaration sortie | Adoption, restitution, transfert, deces, euthanasie |
| Mise a jour | Changement de detenteur (adoption) |

- Priorite : API I-CAD si convention disponible
- Fallback : lien pre-rempli vers portail I-CAD + saisie manuelle retour
- Champ `icad_status` sur chaque mouvement pour tracer les declarations

---

## 6. Transition automatique fourriere → refuge

### CRON quotidien (Supabase Edge Function, 8h chaque jour)

1. Recuperer animaux en statut `pound`
2. Calculer jours ouvres depuis `pound_entry_date` (exclure weekends + jours feries)
3. Si >= 8 jours : creer mouvement `shelter_transfer`, passer statut a `shelter`, notifier equipe
4. Si 6-7 jours : alerte "Fin de fourriere imminente" sur dashboard

### Fonction SQL

```sql
CREATE FUNCTION count_business_days(start_date DATE, end_date DATE)
RETURNS INT AS $$
  SELECT COUNT(*)::INT
  FROM generate_series(start_date + 1, end_date, '1 day') d
  WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
    AND d NOT IN (SELECT date FROM public_holidays);
$$ LANGUAGE SQL STABLE;
```

### Table `public_holidays`

Pre-remplie avec les jours feries francais, mise a jour annuelle.

---

## 7. Facturation refuge et dons / CERFA

### Facturation

Reutilise le systeme de documents existant du CRM :
- Frais d'adoption → facture a l'adoptant
- Frais de fourriere → facture a la mairie/collectivite
- Frais veterinaires → facture au proprietaire retrouve
- Convention fourriere → devis annuel a la commune

### Dons et recus fiscaux CERFA

- Table `donations` dediee
- Generation PDF CERFA via pipeline Puppeteer existant
- Numerotation : `CERFA-{YEAR}-{SEQUENCE}`
- Contenu legal : nom ARUP, SIREN, donateur, montant (chiffres + lettres), article 200/238 bis CGI
- Vue recapitulative annuelle exportable CSV

---

## Stack technique recapitulatif

| Composant | Technologie |
|-----------|------------|
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind CSS v4 |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| IA texte | API Claude (Haiku/Sonnet) |
| Publication sociale | Meta Graph API (Facebook Pages + Instagram) |
| PDF | Puppeteer + Chrome |
| CRON | Supabase Edge Functions (transition fourriere) |
| I-CAD | API I-CAD ou fallback portail web |
| Deploiement | Docker + Coolify |
