# Mise a jour du 02/03/2026

## Resume des nouvelles fonctionnalites

Cette mise a jour apporte 5 nouveaux modules au refuge. Chaque module necessite l'execution d'une migration SQL dans **Supabase Dashboard > SQL Editor**.

**Ordre d'execution obligatoire** (certaines migrations dependent des precedentes) :

| # | Migration | Description |
|---|-----------|-------------|
| 1 | `20260302_outing_ratings.sql` | Notes de sortie (1-10) |
| 2 | `20260302_outing_assignments.sql` | Systeme d'assignation des sorties |
| 3 | `20260302_activity_logs.sql` | Journal d'activite (audit trail) |
| 4 | `20260302_adoptable_field.sql` | Champ "A l'adoption" sur les animaux |
| 5 | `20260302_tig_outings.sql` | Sorties TIG (Travaux d'Interet General) |

---

## 1. Notes de sortie (`20260302_outing_ratings.sql`)

### Ce que ca fait
Chaque sortie peut desormais recevoir une note de 1 a 10 avec un commentaire. Le commentaire est **obligatoire pour les notes de 5 ou moins** afin de documenter les problemes rencontres.

### Colonnes ajoutees
- `animal_outings.rating` : entier de 1 a 10
- `animal_outings.rating_comment` : texte libre

### Code couleur des notes dans l'interface
- **1-3** : Rouge (probleme grave)
- **4-5** : Orange (difficultes)
- **6-7** : Jaune (correct)
- **8-10** : Vert (bonne sortie)

### SQL a executer

```sql
ALTER TABLE animal_outings
  ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 10),
  ADD COLUMN IF NOT EXISTS rating_comment TEXT;
```

---

## 2. Assignation des sorties (`20260302_outing_assignments.sql`)

### Ce que ca fait
Les managers peuvent assigner des chiens specifiques a des personnes pour la journee. Le systeme suit la completion des assignations et reporte automatiquement les assignations non realisees au jour suivant avec un badge "En retard".

### Nouvelle permission
- `manage_outing_assignments` : permet d'assigner des sorties (activee par defaut pour le groupe Administrateur)

### Nouvelle table
- `outing_assignments` : assignations (animal, personne, date, lien vers la sortie realisee)

### Fonctionnalites
- **Panneau d'assignation** : visible par les managers, permet de selectionner un animal et une personne
- **Mes assignations** : chaque utilisateur voit ses assignations du jour sur la page Sorties
- **Auto-liaison** : quand un utilisateur enregistre une sortie pour un animal qui lui etait assigne, l'assignation est automatiquement marquee comme completee
- **Persistance** : les assignations non realisees restent visibles les jours suivants avec un badge "En retard (J+N)"
- **Statistiques** : taux de completion par personne et par jour (onglet Statistiques)

### SQL a executer

```sql
-- 1. Nouvelle permission
ALTER TABLE permission_groups
  ADD COLUMN IF NOT EXISTS manage_outing_assignments BOOLEAN NOT NULL DEFAULT false;

UPDATE permission_groups
SET manage_outing_assignments = true
WHERE is_system = true AND name = 'Administrateur';

-- 2. Mise a jour de user_has_permission()
CREATE OR REPLACE FUNCTION user_has_permission(est_id UUID, perm_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM establishment_members em
    JOIN member_groups mg ON mg.member_id = em.id
    JOIN permission_groups pg ON pg.id = mg.group_id
    WHERE em.user_id = auth.uid()
      AND em.establishment_id = est_id
      AND (
        CASE perm_name
          WHEN 'manage_documents'           THEN pg.manage_documents
          WHEN 'manage_clients'             THEN pg.manage_clients
          WHEN 'manage_establishment'       THEN pg.manage_establishment
          WHEN 'manage_animals'             THEN pg.manage_animals
          WHEN 'view_animals'               THEN pg.view_animals
          WHEN 'manage_health'              THEN pg.manage_health
          WHEN 'manage_movements'           THEN pg.manage_movements
          WHEN 'manage_boxes'               THEN pg.manage_boxes
          WHEN 'manage_posts'               THEN pg.manage_posts
          WHEN 'manage_donations'           THEN pg.manage_donations
          WHEN 'manage_outings'             THEN pg.manage_outings
          WHEN 'manage_outing_assignments'  THEN pg.manage_outing_assignments
          WHEN 'view_pound'                 THEN pg.view_pound
          WHEN 'view_statistics'            THEN pg.view_statistics
          ELSE false
        END
      )
  );
$$;

-- 3. Table outing_assignments
CREATE TABLE IF NOT EXISTS outing_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  animal_id         UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  assigned_to       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  outing_id         UUID REFERENCES animal_outings(id) ON DELETE SET NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(animal_id, assigned_to, date)
);

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_outing_assignments_est_date
  ON outing_assignments(establishment_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_outing_assignments_assigned_to
  ON outing_assignments(assigned_to, date DESC);
CREATE INDEX IF NOT EXISTS idx_outing_assignments_animal
  ON outing_assignments(animal_id, date DESC);

-- 5. RLS
ALTER TABLE outing_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'outing_assignments_select') THEN
    CREATE POLICY "outing_assignments_select" ON outing_assignments FOR SELECT USING (
      establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'outing_assignments_insert') THEN
    CREATE POLICY "outing_assignments_insert" ON outing_assignments FOR INSERT WITH CHECK (
      user_has_permission(establishment_id, 'manage_outing_assignments')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'outing_assignments_update') THEN
    CREATE POLICY "outing_assignments_update" ON outing_assignments FOR UPDATE USING (
      user_has_permission(establishment_id, 'manage_outing_assignments')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'outing_assignments_delete') THEN
    CREATE POLICY "outing_assignments_delete" ON outing_assignments FOR DELETE USING (
      user_has_permission(establishment_id, 'manage_outing_assignments')
    );
  END IF;
END $$;
```

---

## 3. Journal d'activite (`20260302_activity_logs.sql`)

### Ce que ca fait
Toutes les actions effectuees par les utilisateurs sont tracees dans un journal d'audit. Ce journal est **visible uniquement par les administrateurs** dans l'onglet "Activite" de chaque fiche animal.

### Actions tracees
- Creation, modification, suppression d'animaux
- Modifications de sante (vaccins, traitements, etc.)
- Mouvements (entrees, sorties, transferts)
- Toggle "A l'adoption"
- Et toute future action ajoutee au systeme

### Nouvelle table
- `activity_logs` : journal immutable (pas de modification ni suppression possible)

### SQL a executer

```sql
-- 1. Table activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id  UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action            TEXT NOT NULL,
  entity_type       TEXT NOT NULL,
  entity_id         UUID,
  entity_name       TEXT,
  parent_type       TEXT,
  parent_id         UUID,
  details           JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Index
CREATE INDEX IF NOT EXISTS idx_activity_logs_est_date
  ON activity_logs(establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity
  ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user
  ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_parent
  ON activity_logs(parent_type, parent_id, created_at DESC);

-- 3. RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'activity_logs_select') THEN
    CREATE POLICY "activity_logs_select" ON activity_logs FOR SELECT USING (
      EXISTS (
        SELECT 1
        FROM establishment_members em
        JOIN member_groups mg ON mg.member_id = em.id
        JOIN permission_groups pg ON pg.id = mg.group_id
        WHERE em.user_id = auth.uid()
          AND em.establishment_id = activity_logs.establishment_id
          AND pg.is_system = true
          AND pg.name = 'Administrateur'
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'activity_logs_insert') THEN
    CREATE POLICY "activity_logs_insert" ON activity_logs FOR INSERT WITH CHECK (
      establishment_id IN (
        SELECT establishment_id FROM establishment_members WHERE user_id = auth.uid()
      )
    );
  END IF;
END $$;
```

---

## 4. Champ "A l'adoption" (`20260302_adoptable_field.sql`)

### Ce que ca fait
Chaque animal peut etre marque comme etant "a l'adoption" via un toggle directement sur sa carte dans la liste des animaux. Un filtre permet de n'afficher que les animaux adoptables ou non adoptables.

### Nouvelle permission
- `manage_adoptions` : permet de toggler le statut "A l'adoption" (activee par defaut pour le groupe Administrateur)

### Colonne ajoutee
- `animals.adoptable` : booleen (false par defaut)

### Fonctionnalites
- **Toggle sur chaque carte** : badge vert avec coeur quand l'animal est a l'adoption
- **Filtre** : dropdown "Adoption : tous / A l'adoption / Non adoptable" dans la liste
- **Permission dediee** : separee de `manage_animals` pour un controle fin

### SQL a executer

```sql
-- 1. Colonne adoptable
ALTER TABLE animals ADD COLUMN IF NOT EXISTS adoptable BOOLEAN NOT NULL DEFAULT false;

-- 2. Permission manage_adoptions
ALTER TABLE permission_groups
  ADD COLUMN IF NOT EXISTS manage_adoptions BOOLEAN NOT NULL DEFAULT false;

UPDATE permission_groups
SET manage_adoptions = true
WHERE is_system = true AND name = 'Administrateur';

-- 3. Mise a jour de user_has_permission()
-- IMPORTANT : cette version inclut manage_outing_assignments ET manage_adoptions
-- Elle remplace la version de la migration 2
CREATE OR REPLACE FUNCTION user_has_permission(est_id UUID, perm_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM establishment_members em
    JOIN member_groups mg ON mg.member_id = em.id
    JOIN permission_groups pg ON pg.id = mg.group_id
    WHERE em.user_id = auth.uid()
      AND em.establishment_id = est_id
      AND (
        CASE perm_name
          WHEN 'manage_documents'           THEN pg.manage_documents
          WHEN 'manage_clients'             THEN pg.manage_clients
          WHEN 'manage_establishment'       THEN pg.manage_establishment
          WHEN 'manage_animals'             THEN pg.manage_animals
          WHEN 'view_animals'               THEN pg.view_animals
          WHEN 'manage_health'              THEN pg.manage_health
          WHEN 'manage_movements'           THEN pg.manage_movements
          WHEN 'manage_boxes'               THEN pg.manage_boxes
          WHEN 'manage_posts'               THEN pg.manage_posts
          WHEN 'manage_donations'           THEN pg.manage_donations
          WHEN 'manage_outings'             THEN pg.manage_outings
          WHEN 'manage_outing_assignments'  THEN pg.manage_outing_assignments
          WHEN 'manage_adoptions'           THEN pg.manage_adoptions
          WHEN 'view_pound'                 THEN pg.view_pound
          WHEN 'view_statistics'            THEN pg.view_statistics
          ELSE false
        END
      )
  );
$$;
```

---

## 5. Sorties TIG (`20260302_tig_outings.sql`)

### Ce que ca fait
Les managers et administrateurs peuvent enregistrer des sorties effectuees par des TIG (Travaux d'Interet General) — des personnes qui ne sont generalement pas inscrites dans le systeme.

### Approche
- Un bouton "TIG" (ambre) apparait a cote du bouton "Enregistrer une sortie" sur chaque carte animal
- Un champ optionnel permet de saisir le nom de la personne TIG
- Le `walked_by` enregistre l'ID du manager (pour l'audit), pas du TIG
- Les sorties TIG sont **exclues du leaderboard individuel** (pas de competition avec les benevoles)
- Elles sont **incluses dans les stats par animal** et les tendances (car le chien a bien ete sorti)
- Un compteur "Sorties TIG" apparait dans les KPIs des statistiques

### Colonnes ajoutees
- `animal_outings.is_tig` : booleen (false par defaut)
- `animal_outings.tig_walker_name` : texte libre optionnel

### Affichage
- Badge ambre avec icone casque dans l'historique et la fiche animal
- Format : "TIG" ou "TIG — Nom du TIG"

### SQL a executer

```sql
ALTER TABLE animal_outings
  ADD COLUMN IF NOT EXISTS is_tig BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE animal_outings
  ADD COLUMN IF NOT EXISTS tig_walker_name TEXT;
```

---

## Autres ameliorations incluses (sans migration)

### Dashboard
- Ajout du compteur **familles d'accueil** dans les statistiques du dashboard

### Fiche animal
- Nouvel onglet **Sorties** affichant l'historique complet des sorties de l'animal (date, note, promeneur, duree, commentaire)
- Nouvel onglet **Activite** (admin uniquement) affichant le journal d'audit de l'animal

### Page Sorties
- Reorganisation de la page : Mes assignations > Panneau d'assignation > Historique > Priorite
- Note explicative sur la definition d'une sortie (exterieur ou fouloir, minimum 15 minutes)
- Les chiens deja promenes aujourd'hui apparaissent en premier dans la liste de priorite

### Permissions
- Correction du toggle des permissions sur les groupes systeme (Administrateur) — les toggles etaient desactives par erreur
- Nouvelles permissions visibles dans Etablissement > Groupes : "Assignations sorties" et "Gestion adoptions"

---

## Verification apres migration

1. Executer les 5 migrations dans l'ordre dans Supabase Dashboard > SQL Editor
2. Verifier que les nouvelles colonnes apparaissent dans les tables (`animal_outings`, `animals`, `permission_groups`)
3. Verifier que la table `outing_assignments` a ete creee
4. Verifier que la table `activity_logs` a ete creee
5. Dans l'application, aller dans Etablissement > Groupes et verifier que "Assignations sorties" et "Gestion adoptions" apparaissent
6. Tester : enregistrer une sortie avec une note, assigner un chien, toggler "A l'adoption", enregistrer une sortie TIG
