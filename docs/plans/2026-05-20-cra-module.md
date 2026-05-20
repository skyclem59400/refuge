# Optimus — Module CRA (Compte-Rendu d'Activité) — Plan d'implémentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permettre à Mary (manager/admin) de saisir les heures travaillées de chaque salarié SDA, mois par mois. Le collaborateur consulte son CRA dans son espace, peut valider ou demander une modification (Clément notifié à chaque demande). Une fois validé, Mary peut envoyer le CRA au comptable. Le système doit aussi servir de base pour estimer la charge salariale prévisionnelle.

**Pourquoi maintenant:** Le module "CRA" existant n'est qu'un **calcul automatique** des absences (`getMonthlyCra` dans `src/lib/actions/cra.ts`) — il ne permet ni saisie d'heures réelles, ni workflow de validation. Mary saisit aujourd'hui ses CRA à la main hors de l'outil → friction + risque d'erreur + perte du lien avec les soldes de congés.

**Architecture:** Extension du CRM Optimus. 3 nouvelles tables Supabase (`member_work_schedules`, `cra_entries`, `cra_monthly_status`), 4 nouvelles pages App Router, 3 server actions principales, un endpoint d'envoi comptable réutilisant Puppeteer. Pas de nouveau service externe.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (PostgreSQL + RLS), Tailwind v4, TypeScript 5, Puppeteer (PDF — déjà en place), Sonner (toasts), Lucide React.

---

## Contexte métier — décisions actées le 2026-05-20

**Salariés concernés** (6 actifs + 1 arrêt long) :

| Salarié·e | Quotité | h/sem | Jours de repos |
|-----------|---------|-------|----------------|
| Mary | 100 % | 35h | Mer + Dim |
| Franck | 100 % | 35h | Jeu + Dim |
| Marina | 100 % | 35h | Mar + Dim |
| Yann | 100 % | 35h | Mar + Dim |
| Carole | 80 % | 28h | Mer + Ven + Dim |
| Matthieu | Variable | — | Saisie au cas par cas (besoins ferme) |
| Éric | — | — | Arrêt longue durée (exclus du CRA actif) |

**Horaire standard partagé** : 8h00-12h00 / 14h00-17h00 = 7h/jour (sauf Matthieu = variable).
**Règle absolue** : aucun horaire ne dépasse 17h00.

**Céline n'est PAS salariée** — Secrétaire générale de l'association (bureau). Exclue du périmètre CRA.

**Workflow validé** :
1. `draft` — Mary saisit (pré-rempli depuis le template)
2. `submitted` — Mary soumet au collaborateur
3. Le collaborateur ouvre son espace :
   - clic "Valider mon CRA" → `validated_by_member`
   - OU clic "Demander modification" + commentaire → repasse en `draft`, **notification email + bell à Clément**
4. `sent` — Mary clique "Envoyer au comptable" → email + PDF en PJ

**Granularité de saisie** : quart d'heure (08:00, 08:15, 08:30, 08:45).
**Comptable** : email à configurer plus tard dans `establishments.accountant_email`.
**Use case secondaire** : exploiter les CRA pour estimer la charge salariale prévisionnelle (dashboard à venir, hors scope MVP).

---

## Task 1 : Schéma SQL — 3 nouvelles tables + extension `establishments`

**Files:**
- Create: `supabase/migrations/20260520c_cra_module.sql`

**Step 1: Migration**

```sql
-- ============================================
-- Optimus — Module CRA
-- ============================================

-- 1. Email comptable au niveau établissement
ALTER TABLE establishments
  ADD COLUMN IF NOT EXISTS accountant_email TEXT,
  ADD COLUMN IF NOT EXISTS accountant_name TEXT;

-- 2. Semaine type d'un salarié (référence pour pré-remplissage CRA)
CREATE TABLE IF NOT EXISTS member_work_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES establishment_members(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=dim, 6=sam
  is_rest_day BOOLEAN NOT NULL DEFAULT FALSE,
  start_am TIME,   -- ex 08:00
  end_am TIME,     -- ex 12:00
  start_pm TIME,   -- ex 14:00
  end_pm TIME,     -- ex 17:00
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE, -- NULL = encore valide
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT day_consistency CHECK (
    (is_rest_day AND start_am IS NULL AND end_am IS NULL AND start_pm IS NULL AND end_pm IS NULL)
    OR (NOT is_rest_day AND start_am IS NOT NULL AND end_am IS NOT NULL)
  )
);

CREATE INDEX idx_work_schedules_member ON member_work_schedules(member_id, valid_from);
CREATE UNIQUE INDEX uniq_work_schedules_current
  ON member_work_schedules(member_id, day_of_week)
  WHERE valid_until IS NULL;

-- 3. Override d'un jour précis (uniquement si différent du template)
CREATE TABLE IF NOT EXISTS cra_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES establishment_members(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_rest_day BOOLEAN NOT NULL DEFAULT FALSE,
  start_am TIME,
  end_am TIME,
  start_pm TIME,
  end_pm TIME,
  hours_total NUMERIC(4,2) GENERATED ALWAYS AS (
    COALESCE(EXTRACT(EPOCH FROM (end_am - start_am)) / 3600.0, 0)
    + COALESCE(EXTRACT(EPOCH FROM (end_pm - start_pm)) / 3600.0, 0)
  ) STORED,
  notes TEXT,
  entered_by UUID REFERENCES auth.users(id),
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (member_id, date)
);

CREATE INDEX idx_cra_entries_member_month ON cra_entries(member_id, date);
CREATE INDEX idx_cra_entries_establishment ON cra_entries(establishment_id, date);

-- 4. Statut mensuel + audit du workflow
CREATE TABLE IF NOT EXISTS cra_monthly_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES establishment_members(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  year SMALLINT NOT NULL,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'validated_by_member', 'change_requested', 'sent')),
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id),
  change_requested_at TIMESTAMPTZ,
  change_request_comment TEXT,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES auth.users(id),
  sent_to TEXT, -- email du comptable au moment de l'envoi
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (member_id, year, month)
);

CREATE INDEX idx_cra_status_member_period ON cra_monthly_status(member_id, year, month);

-- 5. Audit log des demandes de modification (pour Clément)
CREATE TABLE IF NOT EXISTS cra_change_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cra_status_id UUID NOT NULL REFERENCES cra_monthly_status(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES establishment_members(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  requested_by UUID REFERENCES auth.users(id),
  comment TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT
);

CREATE INDEX idx_change_requests_member ON cra_change_requests(member_id, requested_at DESC);

-- 6. RLS — un membre voit son CRA, les admins voient tout
ALTER TABLE member_work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE cra_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cra_monthly_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE cra_change_requests ENABLE ROW LEVEL SECURITY;

-- Lecture : un user voit ses propres lignes + les admins voient celles de leur établissement
CREATE POLICY work_schedules_read ON member_work_schedules FOR SELECT
  USING (
    establishment_id IN (SELECT user_establishment_ids())
  );

CREATE POLICY cra_entries_read ON cra_entries FOR SELECT
  USING (
    establishment_id IN (SELECT user_establishment_ids())
  );

CREATE POLICY cra_status_read ON cra_monthly_status FOR SELECT
  USING (
    establishment_id IN (SELECT user_establishment_ids())
  );

CREATE POLICY change_requests_read ON cra_change_requests FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM establishment_members WHERE establishment_id IN (SELECT user_establishment_ids())
    )
  );

-- Écriture : tout passe par les server actions (qui utilisent createAdminClient + requirePermission)
-- => Pas de policy d'écriture publique. Service role bypass RLS de toute façon.
```

**Step 2 : Seed des semaines types** (script séparé, exécutable dans Supabase SQL Editor)

```sql
-- À exécuter une fois après la migration. Adapter les member_id selon l'établissement.
-- Récupérer les IDs : SELECT id, full_name FROM establishment_members WHERE establishment_id = '<SDA_EST_ID>';

-- Exemple pour Mary (100%, repos Mer + Dim) — à dupliquer pour chaque salarié
INSERT INTO member_work_schedules (member_id, establishment_id, day_of_week, is_rest_day, start_am, end_am, start_pm, end_pm)
VALUES
  ('<MARY_ID>', '<SDA_EST_ID>', 0, TRUE, NULL, NULL, NULL, NULL),       -- Dim
  ('<MARY_ID>', '<SDA_EST_ID>', 1, FALSE, '08:00', '12:00', '14:00', '17:00'), -- Lun
  ('<MARY_ID>', '<SDA_EST_ID>', 2, FALSE, '08:00', '12:00', '14:00', '17:00'), -- Mar
  ('<MARY_ID>', '<SDA_EST_ID>', 3, TRUE, NULL, NULL, NULL, NULL),       -- Mer
  ('<MARY_ID>', '<SDA_EST_ID>', 4, FALSE, '08:00', '12:00', '14:00', '17:00'), -- Jeu
  ('<MARY_ID>', '<SDA_EST_ID>', 5, FALSE, '08:00', '12:00', '14:00', '17:00'), -- Ven
  ('<MARY_ID>', '<SDA_EST_ID>', 6, FALSE, '08:00', '12:00', '14:00', '17:00'); -- Sam
```

**Success criteria:**
- Migration exécutée sans erreur sur Supabase prod
- `SELECT * FROM member_work_schedules` retourne 0 lignes initialement
- Seed appliqué pour Mary, Franck, Marina, Yann, Carole (5 salariés × 7 jours = 35 lignes)
- Matthieu : pas de seed (tout en surcharge `cra_entries`)
- Éric : pas de seed (arrêt long)

---

## Task 2 : Types TypeScript

**Files:**
- Modify: `src/lib/types/database.ts`

**Step 1 : Ajouter les interfaces**

```typescript
// Module CRA — semaine type d'un salarié
export interface MemberWorkSchedule {
  id: string
  member_id: string
  establishment_id: string
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6  // 0=dim → 6=sam
  is_rest_day: boolean
  start_am: string | null   // 'HH:MM'
  end_am: string | null
  start_pm: string | null
  end_pm: string | null
  valid_from: string
  valid_until: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// Surcharge d'un jour précis
export interface CraEntry {
  id: string
  member_id: string
  establishment_id: string
  date: string
  is_rest_day: boolean
  start_am: string | null
  end_am: string | null
  start_pm: string | null
  end_pm: string | null
  hours_total: number  // computed
  notes: string | null
  entered_by: string | null
  entered_at: string
  updated_at: string
}

export type CraStatus = 'draft' | 'submitted' | 'validated_by_member' | 'change_requested' | 'sent'

export interface CraMonthlyStatus {
  id: string
  member_id: string
  establishment_id: string
  year: number
  month: number
  status: CraStatus
  submitted_at: string | null
  submitted_by: string | null
  validated_at: string | null
  validated_by: string | null
  change_requested_at: string | null
  change_request_comment: string | null
  sent_at: string | null
  sent_by: string | null
  sent_to: string | null
  created_at: string
  updated_at: string
}

export interface CraChangeRequest {
  id: string
  cra_status_id: string
  member_id: string
  requested_at: string
  requested_by: string | null
  comment: string
  resolved_at: string | null
  resolved_by: string | null
  resolution_notes: string | null
}
```

**Success criteria:** `npx tsc --noEmit` passe sans erreur.

---

## Task 3 : Server actions — Semaines types

**Files:**
- Create: `src/lib/actions/work-schedules.ts`

**Step 1 : CRUD semaine type**

Fonctions à exporter :
- `getMemberWorkSchedule(memberId, atDate?)` — retourne les 7 jours actuels (filtré sur `valid_until IS NULL OR valid_until >= atDate`)
- `listMemberSchedules(establishmentId)` — pour la page admin : tous les membres + leur schedule courant
- `upsertWorkScheduleDay(memberId, dayOfWeek, payload)` — update un jour, versionne si l'horaire change matériellement (sinon update in-place)
- `setRestDay(memberId, dayOfWeek)` — raccourci pour passer un jour en repos
- `bulkSetSchedule(memberId, weekTemplate)` — set les 7 jours d'un coup (utilisé par l'UI quand on clique "Appliquer les horaires standard")

**Note technique** : pour la v1, on ne versionne PAS (on update en place). On ajoute juste `valid_from = CURRENT_DATE` pour traçabilité. Le versioning sera un raffinement si on en a besoin (Carole qui passerait à 70% par exemple).

Toutes les fonctions vérifient `requirePermission('manage_leaves')` ou nouvelle permission `manage_cra` (cf. Task 9).

**Success criteria:**
- `listMemberSchedules()` retourne 5 salariés × 7 jours
- `upsertWorkScheduleDay()` met à jour en base
- Tests manuels via console serveur OK

---

## Task 4 : Server actions — CRA mensuel

**Files:**
- Create: `src/lib/actions/cra-saisie.ts` (à ne pas confondre avec l'existant `src/lib/actions/cra.ts` qui reste pour le PDF auto)

**Step 1 : Fonction de pré-remplissage**

```typescript
/**
 * Construit le CRA mensuel d'un membre :
 * 1. Charge la semaine type (member_work_schedules)
 * 2. Charge les congés validés (leave_requests)
 * 3. Charge les jours fériés (public_holidays)
 * 4. Charge les surcharges existantes (cra_entries)
 * 5. Pour chaque jour du mois, applique dans l'ordre :
 *    - férié → 0h
 *    - congé validé → 0h, libellé congé
 *    - override `cra_entries` → ses horaires
 *    - sinon → semaine type (jour de repos ou horaires standards)
 * Renvoie un tableau de "CraDay" avec status + heures + source ('template' | 'override' | 'leave' | 'holiday').
 */
export async function getMonthlySaisie(memberId, year, month): Promise<{ data?: MonthlySaisie, error?: string }>
```

**Step 2 : Fonctions de saisie**

- `upsertCraEntry(memberId, date, payload)` — crée ou met à jour la surcharge d'un jour
- `deleteCraEntry(memberId, date)` — supprime la surcharge → retour au template
- `submitCraToMember(memberId, year, month)` — passe le statut `draft` → `submitted`, notifie le collab
- `validateCraAsMember(memberId, year, month)` — passe `submitted` → `validated_by_member`
- `requestChange(memberId, year, month, comment)` — passe `submitted` → `change_requested`, INSÈRE une ligne `cra_change_requests`, **notifie Clément (email + bell)**
- `markCraAsResolved(changeRequestId, resolutionNotes)` — Mary clique "Pris en compte", repasse en `draft`
- `sendCraToAccountant(memberId, year, month)` — passe `validated_by_member` → `sent`, génère PDF, envoie email

**Step 3 : Notification Clément**

Réutiliser le système de notification existant (`src/lib/notifications/` si présent, sinon Bell component + table `notifications`). Vérifier ce qui existe avant d'ajouter.

**Success criteria:**
- `getMonthlySaisie('mary-id', 2026, 5)` retourne 31 jours dont mercredis et dimanches marqués `rest`
- `upsertCraEntry()` crée une surcharge visible au prochain appel
- `requestChange()` crée la trace + notification Clément

---

## Task 5 : Page "Horaires de référence"

**Files:**
- Create: `src/app/(app)/admin/cra/horaires/page.tsx`
- Create: `src/components/cra/work-schedule-editor.tsx`

**Step 1 : Page liste**

Layout : tableau collaborateurs × 7 jours. Chaque cellule affiche soit "Repos" soit "8:00–12:00 / 14:00–17:00". Bouton "Modifier" par ligne ouvre un modal.

**Step 2 : Modal éditeur**

Pour chaque jour (Lun à Dim) :
- Toggle "Travaillé / Repos"
- 4 inputs `<input type="time" step="900">` (step 900s = 15min) : début matin, fin matin, début aprem, fin aprem
- Validation : aucun horaire > 17:00, fin > début, matin avant aprem
- Total heures du jour affiché en temps réel
- Total semaine affiché en bas

Bouton "Appliquer aux 5 jours travaillés" pour propager rapidement le standard 8-12/14-17.

**Success criteria:**
- Mary peut éditer la semaine de Carole, sauver, recharger : OK
- Validation côté client refuse 18:00, refuse "fin avant début"
- Total semaine = 35h ou 28h selon le cas, calculé en live

---

## Task 6 : Page "Saisie CRA mensuelle"

**Files:**
- Create: `src/app/(app)/admin/cra/saisie/page.tsx`
- Create: `src/components/cra/monthly-grid.tsx`
- Create: `src/components/cra/day-edit-modal.tsx`

**Step 1 : Sélecteur en haut**

- Dropdown collaborateur (les 5 salariés + Matthieu)
- Navigation mois (← Mai 2026 →)
- Badge de statut : Brouillon / Soumis / Validé / Envoyé / Modif demandée

**Step 2 : Grille mensuelle**

Tableau lundi-dimanche × ~5 semaines. Chaque cellule :
- Numéro du jour
- Heures totales (couleur : vert = template, bleu = override, gris = repos, orange = férié, violet = congé)
- Au survol : tooltip "8:00–12:00 / 14:00–17:00"
- Au clic : ouvre modal d'édition pour ce jour

**Step 3 : Modal édition jour**

Mêmes 4 inputs time que la semaine type. Bouton "Retour au template" qui supprime l'override.
Champ "Notes" optionnel (ex : "intervention astreinte 6h-8h").

**Step 4 : Footer**

- Récap mois : total heures travaillées, total absences, ventilation par type de congé
- Si statut = `draft` : bouton "Soumettre au collaborateur"
- Si statut = `validated_by_member` : bouton "Envoyer au comptable"
- Si statut = `change_requested` : bandeau avec le commentaire + bouton "Marquer comme pris en compte"

**Success criteria:**
- Mary ouvre le mois de Mary pour mai 2026 : tous les jours travaillés affichent 7h, Mer + Dim affichent "Repos"
- Modifier un jour → surcharge visible immédiatement
- Soumettre → bouton disparaît, statut passe à "Soumis"

---

## Task 7 : Page collaborateur

**Files:**
- Create: `src/app/(app)/espace-collaborateur/cra/page.tsx`
- Create: `src/app/(app)/espace-collaborateur/cra/[year]/[month]/page.tsx`
- Create: `src/components/cra/member-cra-view.tsx`

**Step 1 : Liste mensuelle**

Liste des CRA accessibles pour le collaborateur connecté (filtré par `member_id = current_user`). Pour chaque mois : statut, action principale.

**Step 2 : Vue détail mois**

Grille lecture seule (réutiliser `MonthlyGrid` en mode readOnly). Footer :
- Si statut = `submitted` : 2 boutons "Valider mon CRA" + "Demander une modification"
- Si statut = `validated_by_member` : badge "Validé le X par moi"
- Si `change_requested` : afficher mon commentaire + statut "En attente de Mary"
- Lien "Télécharger en PDF"

**Step 3 : Modal demande de modification**

Textarea obligatoire. Au submit → `requestChange()` → toast confirmation + redirection liste.

**Success criteria:**
- Connecté en tant que Franck : voir uniquement les CRA de Franck
- Demander une modification : Clément reçoit la notification, Mary voit le bandeau orange

---

## Task 8 : Notification Clément + bell

**Files:**
- Read: vérifier l'existence de `src/lib/notifications/` ou équivalent
- Modify ou create selon l'existant

**Step 1 : Audit de l'existant**

Avant de coder : `grep -r "notification" src/lib` et `find src/components -name "*bell*"` pour réutiliser ce qui existe (système d'alerte sur les soldes de congés probable).

**Step 2 : Hook dans `requestChange`**

À chaque demande de modif :
1. INSERT dans `cra_change_requests`
2. INSERT dans la table notifications (si elle existe) ciblée sur Clément (`clement.scailteux@gmail.com`)
3. Envoi email via Brevo (template "Demande de modification CRA — [Salarié] [Mois Année]")

**Step 3 : Vue centralisée**

`/admin/cra/demandes` : liste des demandes en cours pour les voir d'un coup d'œil.

**Success criteria:**
- Clément voit la pastille rouge sur la bell après une demande de modif
- Email reçu dans sa boîte
- Une fois la demande résolue, la notification disparaît

---

## Task 9 : Permissions

**Files:**
- Modify: `src/lib/establishment/permissions.ts`
- Modify: schéma `establishment_members` (si nécessaire)

**Step 1 : Nouvelle permission**

Ajouter `manage_cra` aux booleans de `establishment_members`. Migration :

```sql
ALTER TABLE establishment_members ADD COLUMN IF NOT EXISTS manage_cra BOOLEAN DEFAULT FALSE;
UPDATE establishment_members SET manage_cra = TRUE WHERE role = 'admin' OR full_name ILIKE '%mary%';
```

**Step 2 : Mise à jour `requirePermission`**

Ajouter `'manage_cra'` aux types acceptés.

**Step 3 : UI conditionnelle**

Le menu sidebar "CRA — Saisie" n'apparaît que si `manage_cra` ou role=admin. Le menu "Mon CRA" apparaît pour tous les salariés.

**Success criteria:**
- Mary a le menu Saisie. Franck ne l'a pas, mais a "Mon CRA".

---

## Task 10 : Envoi comptable + PDF

**Files:**
- Create: `src/lib/cra/pdf-saisie-template.ts` (peut s'inspirer ou réutiliser `cra-template.ts` existant)
- Create: `src/app/api/cra/send-to-accountant/route.ts`
- Modify: page Saisie pour brancher le bouton

**Step 1 : Template PDF**

Variante du template `cra-template.ts` existant qui consomme `cra_entries` au lieu de calculer depuis les congés. Affichage grille mensuelle + récap + signature numérique (date validation + nom du collaborateur).

**Step 2 : Endpoint envoi**

POST `/api/cra/send-to-accountant` body : `{ memberId, year, month }`.
1. Vérifie statut = `validated_by_member`
2. Génère PDF via Puppeteer
3. Envoie email via Brevo à `establishments.accountant_email` (404 si non configuré)
4. Met à jour `cra_monthly_status` → `sent`

**Step 3 : Page paramètres**

Dans `/admin/etablissement` : 2 champs `accountant_email` + `accountant_name`.

**Success criteria:**
- Envoi test à clement.scailteux@gmail.com : email reçu avec PDF en PJ propre
- Une fois envoyé, le statut bloque tout retour en arrière (badge "Envoyé le X" en lecture seule)

---

## Task 11 : RECAP + doc utilisateurs

**Files:**
- Modify: `RECAP.md` (section nouvelle "11. Module CRA")
- Modify: `docs/nouveautes-equipe-mai-2026.md` (ajouter une section CRA pour l'équipe)
- Régénérer le PDF

**Step 1 :** documenter chaque écran avec capture, expliquer le workflow à Mary et aux collaborateurs.

---

## Points à valider en cours de route

1. **Existence d'un système de notification** — à vérifier en Task 8 avant de coder. Si rien : créer une table `notifications` minimaliste.
2. **Email comptable Clément** — Mary saisit l'email du comptable dans `/admin/etablissement` une fois qu'on l'aura.
3. **Matthieu** — voir comment le pré-remplissage fonctionne sans semaine type (tout en `cra_entries`). On peut soit créer un schedule "vide" (7 jours en repos) soit traiter le cas spécifiquement dans `getMonthlySaisie`.
4. **Carole 80% nominal vs 80% réel** — actuellement le tableau confirme 28h (4 × 7h). Pas de divergence à gérer.
5. **Reprise des heures sup en cas de dépassement** — pas dans le MVP, à voir avec le comptable plus tard.

---

## Ordre d'exécution recommandé

```
Task 1 (migrations + seed)
   ↓
Task 2 (types TypeScript)
   ↓
Task 3 (server actions schedules)  ─┐
Task 4 (server actions CRA)         ├─→ Task 5 (page horaires)
                                    ├─→ Task 6 (page saisie)
                                    └─→ Task 7 (page collab)
   ↓
Task 9 (permissions) en parallèle
   ↓
Task 8 (notifications) ← bloque la fin de Task 4 si réutilisable, sinon en parallèle de Tasks 5-7
   ↓
Task 10 (envoi comptable)
   ↓
Task 11 (doc)
```

**Estimation** : 1 à 2 sessions de dev (4-8h) si tout va bien.
**Premier livrable** : Tasks 1 à 6 → Mary peut déjà saisir des CRA sans validation collaborateur ni envoi comptable. Permet de tester en condition réelle avec Mary avant de finaliser le workflow.

---

## Définition de "terminé"

- [ ] Migrations appliquées en prod (Coolify auto-deploy après push main)
- [ ] Seed exécuté pour les 5 salariés (Mary, Franck, Marina, Yann, Carole)
- [ ] Mary peut saisir le CRA de mai 2026 pour les 6 personnes (5 salariés + Matthieu)
- [ ] Franck (test collab) peut ouvrir son CRA et le valider
- [ ] Une demande de modification déclenche bien une notification visible côté Clément
- [ ] Envoi au comptable génère un PDF correct (signature collab + ventilation congés)
- [ ] Doc utilisateurs mise à jour + PDF régénéré
- [ ] RECAP.md à jour
- [ ] `npm run build` passe, déploiement Coolify OK
- [ ] Daily journal vault à jour
