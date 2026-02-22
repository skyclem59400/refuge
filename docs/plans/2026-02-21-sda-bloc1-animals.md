# SDA Estormel - Bloc 1 : Gestion Animaux + Fourriere/Refuge - Plan d'implementation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ajouter au CRM existant un module complet de gestion d'animaux avec workflow fourriere/refuge, sidebar dynamique par type d'etablissement, et gestion des box.

**Architecture:** Extension du logiciel de refuge Next.js 16 + Supabase existant. Nouvelles tables Supabase, nouvelles pages dans l'App Router, sidebar conditionnelle selon `establishment.type`, systeme de permissions etendu.

**Tech Stack:** Next.js 16, React 19, Supabase (PostgreSQL + Auth + Storage + Edge Functions), Tailwind CSS v4, TypeScript 5, Puppeteer (PDF), Sonner (toasts), Lucide React (icons)

---

## Task 1 : Schema SQL - Nouvelles tables

**Files:**
- Create: `supabase/migrations/20260221_sda_animals.sql`

**Step 1: Ecrire le fichier de migration SQL**

```sql
-- ============================================
-- SDA Estormel - Tables Animaux & Refuge
-- ============================================

-- 1. Ajouter le type d'etablissement
ALTER TABLE establishments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'farm' CHECK (type IN ('farm', 'shelter', 'both'));

-- 2. Table des jours feries
CREATE TABLE IF NOT EXISTS public_holidays (
  date DATE PRIMARY KEY,
  label TEXT NOT NULL
);

-- Remplir jours feries 2026
INSERT INTO public_holidays (date, label) VALUES
  ('2026-01-01', 'Jour de l''An'),
  ('2026-04-06', 'Lundi de Paques'),
  ('2026-05-01', 'Fete du Travail'),
  ('2026-05-08', 'Victoire 1945'),
  ('2026-05-14', 'Ascension'),
  ('2026-05-25', 'Lundi de Pentecote'),
  ('2026-07-14', 'Fete nationale'),
  ('2026-08-15', 'Assomption'),
  ('2026-11-01', 'Toussaint'),
  ('2026-11-11', 'Armistice'),
  ('2026-12-25', 'Noel')
ON CONFLICT (date) DO NOTHING;

-- 3. Table des box
CREATE TABLE IF NOT EXISTS boxes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species_type TEXT NOT NULL DEFAULT 'mixed' CHECK (species_type IN ('cat', 'dog', 'mixed')),
  capacity INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table des animaux
CREATE TABLE IF NOT EXISTS animals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_secondary TEXT,
  species TEXT NOT NULL CHECK (species IN ('cat', 'dog')),
  breed TEXT,
  breed_cross TEXT,
  sex TEXT NOT NULL DEFAULT 'unknown' CHECK (sex IN ('male', 'female', 'unknown')),
  birth_date DATE,
  birth_place TEXT,
  color TEXT,
  weight DECIMAL(5,2),
  sterilized BOOLEAN DEFAULT FALSE,
  chip_number TEXT,
  tattoo_number TEXT,
  tattoo_position TEXT,
  medal_number TEXT,
  loof_number TEXT,
  passport_number TEXT,
  icad_updated BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pound' CHECK (status IN ('pound', 'shelter', 'adopted', 'returned', 'transferred', 'deceased', 'euthanized')),
  behavior_score INT CHECK (behavior_score BETWEEN 1 AND 5),
  description TEXT,
  capture_location TEXT,
  capture_circumstances TEXT,
  origin_type TEXT NOT NULL DEFAULT 'found' CHECK (origin_type IN ('found', 'abandoned', 'transferred_in', 'surrender')),
  box_id UUID REFERENCES boxes(id) ON DELETE SET NULL,
  pound_entry_date TIMESTAMPTZ,
  shelter_entry_date TIMESTAMPTZ,
  exit_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Table des photos
CREATE TABLE IF NOT EXISTS animal_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Table des mouvements
CREATE TABLE IF NOT EXISTS animal_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('pound_entry', 'shelter_transfer', 'adoption', 'return_to_owner', 'transfer_out', 'death', 'euthanasia')),
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  person_name TEXT,
  person_contact TEXT,
  destination TEXT,
  icad_status TEXT DEFAULT 'pending' CHECK (icad_status IN ('pending', 'declared', 'not_required')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Table des soins
CREATE TABLE IF NOT EXISTS animal_health_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('vaccination', 'sterilization', 'antiparasitic', 'consultation', 'surgery', 'medication', 'behavioral_assessment')),
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT NOT NULL,
  veterinarian TEXT,
  next_due_date DATE,
  cost DECIMAL(10,2),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Index
CREATE INDEX IF NOT EXISTS idx_animals_establishment ON animals(establishment_id);
CREATE INDEX IF NOT EXISTS idx_animals_status ON animals(status);
CREATE INDEX IF NOT EXISTS idx_animals_species ON animals(species);
CREATE INDEX IF NOT EXISTS idx_animals_chip ON animals(chip_number);
CREATE INDEX IF NOT EXISTS idx_animal_photos_animal ON animal_photos(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_movements_animal ON animal_movements(animal_id);
CREATE INDEX IF NOT EXISTS idx_animal_movements_type ON animal_movements(type);
CREATE INDEX IF NOT EXISTS idx_animal_health_animal ON animal_health_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_boxes_establishment ON boxes(establishment_id);

-- 9. Triggers updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_animals_updated_at BEFORE UPDATE ON animals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_boxes_updated_at BEFORE UPDATE ON boxes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. RLS
ALTER TABLE animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read animals" ON animals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert animals" ON animals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update animals" ON animals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete animals" ON animals FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read photos" ON animal_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert photos" ON animal_photos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete photos" ON animal_photos FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read movements" ON animal_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert movements" ON animal_movements FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can read health" ON animal_health_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert health" ON animal_health_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update health" ON animal_health_records FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete health" ON animal_health_records FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read boxes" ON boxes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert boxes" ON boxes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update boxes" ON boxes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete boxes" ON boxes FOR DELETE TO authenticated USING (true);

CREATE POLICY "Anyone can read holidays" ON public_holidays FOR SELECT TO authenticated USING (true);

-- 11. Fonction calcul jours ouvres
CREATE OR REPLACE FUNCTION count_business_days(start_date DATE, end_date DATE)
RETURNS INT AS $$
  SELECT COUNT(*)::INT
  FROM generate_series(start_date + 1, end_date, '1 day') d
  WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
    AND d NOT IN (SELECT date FROM public_holidays);
$$ LANGUAGE SQL STABLE;

-- 12. Storage bucket pour photos animaux
-- (A creer via Supabase Dashboard : bucket "animal-photos", public)
```

**Step 2: Executer la migration sur Supabase**

Run: Copier le SQL dans l'editeur SQL Supabase et executer. Creer le bucket Storage `animal-photos` (public).

**Step 3: Commit**

```bash
git add supabase/migrations/20260221_sda_animals.sql
git commit -m "feat(sda): add database schema for animals, movements, health, boxes"
```

---

## Task 2 : Types TypeScript

**Files:**
- Modify: `src/lib/types/database.ts`

**Step 1: Ajouter les types SDA apres les types existants**

Ajouter a la fin de `src/lib/types/database.ts` :

```typescript
// ============================================
// SDA Estormel - Animal Shelter Types
// ============================================

export type AnimalSpecies = 'cat' | 'dog'
export type AnimalSex = 'male' | 'female' | 'unknown'
export type AnimalStatus = 'pound' | 'shelter' | 'adopted' | 'returned' | 'transferred' | 'deceased' | 'euthanized'
export type AnimalOrigin = 'found' | 'abandoned' | 'transferred_in' | 'surrender'
export type MovementType = 'pound_entry' | 'shelter_transfer' | 'adoption' | 'return_to_owner' | 'transfer_out' | 'death' | 'euthanasia'
export type HealthRecordType = 'vaccination' | 'sterilization' | 'antiparasitic' | 'consultation' | 'surgery' | 'medication' | 'behavioral_assessment'
export type IcadStatus = 'pending' | 'declared' | 'not_required'
export type BoxSpecies = 'cat' | 'dog' | 'mixed'
export type BoxStatus = 'available' | 'occupied' | 'maintenance'
export type EstablishmentType = 'farm' | 'shelter' | 'both'

// Extend Permission type
export type ShelterPermission =
  | Permission
  | 'manage_animals'
  | 'view_animals'
  | 'manage_health'
  | 'manage_movements'
  | 'manage_boxes'
  | 'manage_posts'
  | 'manage_donations'
  | 'view_pound'
  | 'view_statistics'

export interface Animal {
  id: string
  establishment_id: string
  name: string
  name_secondary: string | null
  species: AnimalSpecies
  breed: string | null
  breed_cross: string | null
  sex: AnimalSex
  birth_date: string | null
  birth_place: string | null
  color: string | null
  weight: number | null
  sterilized: boolean
  chip_number: string | null
  tattoo_number: string | null
  tattoo_position: string | null
  medal_number: string | null
  loof_number: string | null
  passport_number: string | null
  icad_updated: boolean
  status: AnimalStatus
  behavior_score: number | null
  description: string | null
  capture_location: string | null
  capture_circumstances: string | null
  origin_type: AnimalOrigin
  box_id: string | null
  pound_entry_date: string | null
  shelter_entry_date: string | null
  exit_date: string | null
  created_at: string
  updated_at: string
}

export interface AnimalPhoto {
  id: string
  animal_id: string
  url: string
  is_primary: boolean
  created_at: string
}

export interface AnimalMovement {
  id: string
  animal_id: string
  type: MovementType
  date: string
  notes: string | null
  person_name: string | null
  person_contact: string | null
  destination: string | null
  icad_status: IcadStatus
  created_by: string | null
  created_at: string
}

export interface AnimalHealthRecord {
  id: string
  animal_id: string
  type: HealthRecordType
  date: string
  description: string
  veterinarian: string | null
  next_due_date: string | null
  cost: number | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface Box {
  id: string
  establishment_id: string
  name: string
  species_type: BoxSpecies
  capacity: number
  status: BoxStatus
  created_at: string
  updated_at: string
}
```

**Step 2: Ajouter `type` a l'interface Establishment existante**

Dans l'interface `Establishment` existante, ajouter apres `logo_url` :

```typescript
  type: EstablishmentType
```

**Step 3: Etendre l'interface Permissions existante**

Dans l'interface `Permissions` existante, ajouter :

```typescript
  canManageAnimals: boolean
  canViewAnimals: boolean
  canManageHealth: boolean
  canManageMovements: boolean
  canManageBoxes: boolean
  canManagePosts: boolean
  canManageDonations: boolean
  canViewPound: boolean
  canViewStatistics: boolean
```

**Step 4: Commit**

```bash
git add src/lib/types/database.ts
git commit -m "feat(sda): add TypeScript types for animals, movements, health, boxes"
```

---

## Task 3 : Etendre le systeme de permissions

**Files:**
- Modify: `src/lib/establishment/permissions.ts`
- Modify: `src/lib/establishment/context.ts`

**Step 1: Ajouter les colonnes permissions a establishment_members**

Executer dans Supabase SQL Editor :

```sql
ALTER TABLE establishment_members
  ADD COLUMN IF NOT EXISTS manage_animals BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS view_animals BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS manage_health BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS manage_movements BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS manage_boxes BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS manage_posts BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS manage_donations BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS view_pound BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS view_statistics BOOLEAN DEFAULT FALSE;
```

**Step 2: Modifier `buildPermissions` dans `context.ts`**

Dans `src/lib/establishment/context.ts`, modifier la fonction `buildPermissions` :

```typescript
function buildPermissions(member: EstablishmentMember): Permissions {
  const isAdmin = member.role === 'admin'
  return {
    isAdmin,
    canManageEstablishment: isAdmin || member.manage_establishment,
    canManageDocuments: isAdmin || member.manage_documents,
    canManageClients: isAdmin || member.manage_clients,
    canManageAnimals: isAdmin || member.manage_animals,
    canViewAnimals: isAdmin || member.view_animals,
    canManageHealth: isAdmin || member.manage_health,
    canManageMovements: isAdmin || member.manage_movements,
    canManageBoxes: isAdmin || member.manage_boxes,
    canManagePosts: isAdmin || member.manage_posts,
    canManageDonations: isAdmin || member.manage_donations,
    canViewPound: isAdmin || member.view_pound,
    canViewStatistics: isAdmin || member.view_statistics,
  }
}
```

**Step 3: Ajouter les cases dans `requirePermission` de `permissions.ts`**

Dans le switch de `requirePermission`, ajouter :

```typescript
      case 'manage_animals': return ctx.membership.manage_animals
      case 'view_animals': return ctx.membership.view_animals
      case 'manage_health': return ctx.membership.manage_health
      case 'manage_movements': return ctx.membership.manage_movements
      case 'manage_boxes': return ctx.membership.manage_boxes
      case 'manage_posts': return ctx.membership.manage_posts
      case 'manage_donations': return ctx.membership.manage_donations
      case 'view_pound': return ctx.membership.view_pound
      case 'view_statistics': return ctx.membership.view_statistics
```

**Step 4: Ajouter les champs a l'interface `EstablishmentMember`**

Dans `src/lib/types/database.ts`, dans l'interface `EstablishmentMember`, ajouter :

```typescript
  manage_animals: boolean
  view_animals: boolean
  manage_health: boolean
  manage_movements: boolean
  manage_boxes: boolean
  manage_posts: boolean
  manage_donations: boolean
  view_pound: boolean
  view_statistics: boolean
```

**Step 5: Commit**

```bash
git add src/lib/establishment/permissions.ts src/lib/establishment/context.ts src/lib/types/database.ts
git commit -m "feat(sda): extend permissions system with shelter-specific permissions"
```

---

## Task 4 : Sidebar dynamique

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

**Step 1: Ajouter les items de navigation refuge**

Remplacer le contenu de `sidebar.tsx`. Le concept : definir `farmNavItems`, `shelterNavItems`, et `commonNavItems`, puis filtrer selon `currentEstablishment.type` et `permissions`.

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/components/theme-provider'
import { EstablishmentSwitcher } from '@/components/establishment/establishment-switcher'
import type { ComponentType } from 'react'
import type { Establishment, Permissions, EstablishmentType } from '@/lib/types/database'
import {
  LayoutDashboard, FileText, Users, Building2, PawPrint,
  Warehouse, HeartPulse, Box, BarChart3
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  Icon: ComponentType<{ className?: string }>
  permission?: keyof Permissions
}

const commonItems: NavItem[] = [
  { href: '/dashboard', label: 'Tableau de bord', Icon: LayoutDashboard },
]

const farmItems: NavItem[] = [
  { href: '/documents', label: 'Documents', Icon: FileText, permission: 'canManageDocuments' },
  { href: '/clients', label: 'Clients', Icon: Users, permission: 'canManageClients' },
]

const shelterItems: NavItem[] = [
  { href: '/animals', label: 'Animaux', Icon: PawPrint, permission: 'canViewAnimals' },
  { href: '/pound', label: 'Fourriere', Icon: Warehouse, permission: 'canViewPound' },
  { href: '/health', label: 'Sante', Icon: HeartPulse, permission: 'canManageHealth' },
  { href: '/boxes', label: 'Box', Icon: Box, permission: 'canManageBoxes' },
  { href: '/documents', label: 'Documents', Icon: FileText, permission: 'canManageDocuments' },
  { href: '/clients', label: 'Repertoire', Icon: Users, permission: 'canManageClients' },
  { href: '/statistics', label: 'Statistiques', Icon: BarChart3, permission: 'canViewStatistics' },
]

const adminItems: NavItem[] = [
  { href: '/etablissement', label: 'Etablissement', Icon: Building2, permission: 'canManageEstablishment' },
]

function getNavItems(type: EstablishmentType, permissions: Permissions): NavItem[] {
  const typeItems = type === 'farm' ? farmItems
    : type === 'shelter' ? shelterItems
    : [...farmItems, ...shelterItems.filter(si => !farmItems.some(fi => fi.href === si.href))]

  const allItems = [...commonItems, ...typeItems, ...adminItems]

  return allItems.filter(item =>
    !item.permission || permissions[item.permission]
  )
}

interface SidebarProps {
  establishments: Establishment[]
  currentEstablishment: Establishment
  permissions: Permissions
  userEmail?: string
}

export function Sidebar({ establishments, currentEstablishment, permissions, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useTheme()

  const navItems = getNavItems(currentEstablishment.type || 'farm', permissions)

  return (
    <aside
      className={`hidden lg:flex flex-col bg-surface border-r border-border min-h-screen fixed left-0 top-0 transition-all duration-300 z-40
        ${sidebarCollapsed ? 'w-16' : 'w-60'}`}
    >
      <div className="p-4 border-b border-border">
        <EstablishmentSwitcher
          establishments={establishments}
          currentEstablishment={currentEstablishment}
          collapsed={sidebarCollapsed}
          userEmail={userEmail}
        />
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${sidebarCollapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-primary/15 text-primary-light border border-primary/20'
                  : 'text-muted hover:text-text hover:bg-surface-hover'
                }`}
            >
              <item.Icon className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="p-2 border-t border-border">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-muted hover:text-text hover:bg-surface-hover transition-colors text-sm"
          title={sidebarCollapsed ? 'Agrandir' : 'Reduire'}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          {!sidebarCollapsed && <span>Reduire</span>}
        </button>
      </div>
    </aside>
  )
}
```

**Step 2: Verifier que l'app compile**

Run: `cd /Users/clement/.gemini/antigravity/scratch/refuge && npm run build`
Expected: Build reussi (ou warnings seulement)

**Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(sda): dynamic sidebar based on establishment type"
```

---

## Task 5 : Server Actions - Animaux CRUD

**Files:**
- Create: `src/lib/actions/animals.ts`

**Step 1: Creer les server actions pour les animaux**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission, requireEstablishment } from '@/lib/establishment/permissions'
import type { AnimalSpecies, AnimalSex, AnimalOrigin, AnimalStatus } from '@/lib/types/database'

export async function getAnimals(filters?: {
  status?: AnimalStatus
  species?: AnimalSpecies
  search?: string
}) {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()

    let query = admin
      .from('animals')
      .select('*, animal_photos(id, url, is_primary)')
      .eq('establishment_id', establishmentId)
      .order('created_at', { ascending: false })

    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.species) query = query.eq('species', filters.species)
    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,chip_number.ilike.%${filters.search}%,medal_number.ilike.%${filters.search}%`)
    }

    const { data, error } = await query
    if (error) return { error: error.message }
    return { data: data || [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getAnimal(id: string) {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('animals')
      .select('*, animal_photos(*), boxes(name, species_type)')
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .single()

    if (error) return { error: error.message }
    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function createAnimal(data: {
  name: string
  species: AnimalSpecies
  sex: AnimalSex
  origin_type: AnimalOrigin
  breed?: string | null
  breed_cross?: string | null
  birth_date?: string | null
  birth_place?: string | null
  color?: string | null
  weight?: number | null
  chip_number?: string | null
  tattoo_number?: string | null
  tattoo_position?: string | null
  medal_number?: string | null
  loof_number?: string | null
  passport_number?: string | null
  behavior_score?: number | null
  description?: string | null
  capture_location?: string | null
  capture_circumstances?: string | null
  box_id?: string | null
  status?: AnimalStatus
}) {
  try {
    const { establishmentId, userId } = await requirePermission('manage_animals')
    const supabase = await createClient()

    const isPound = !data.status || data.status === 'pound'

    const { data: animal, error } = await supabase
      .from('animals')
      .insert({
        ...data,
        establishment_id: establishmentId,
        status: data.status || 'pound',
        pound_entry_date: isPound ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    // Creer le mouvement d'entree
    if (isPound) {
      await supabase.from('animal_movements').insert({
        animal_id: animal.id,
        type: 'pound_entry',
        date: new Date().toISOString(),
        notes: `Entree en fourriere - ${data.origin_type === 'found' ? 'Trouve' : data.origin_type === 'abandoned' ? 'Abandonne' : data.origin_type === 'transferred_in' ? 'Transfere' : 'Remis'}`,
        created_by: userId,
      })
    }

    revalidatePath('/animals')
    revalidatePath('/pound')
    revalidatePath('/dashboard')
    return { data: animal }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function updateAnimal(id: string, data: Partial<{
  name: string
  name_secondary: string | null
  species: AnimalSpecies
  breed: string | null
  breed_cross: string | null
  sex: AnimalSex
  birth_date: string | null
  birth_place: string | null
  color: string | null
  weight: number | null
  sterilized: boolean
  chip_number: string | null
  tattoo_number: string | null
  tattoo_position: string | null
  medal_number: string | null
  loof_number: string | null
  passport_number: string | null
  icad_updated: boolean
  behavior_score: number | null
  description: string | null
  capture_location: string | null
  capture_circumstances: string | null
  box_id: string | null
}>) {
  try {
    const { establishmentId } = await requirePermission('manage_animals')
    const supabase = await createClient()

    const { data: animal, error } = await supabase
      .from('animals')
      .update(data)
      .eq('id', id)
      .eq('establishment_id', establishmentId)
      .select()
      .single()

    if (error) return { error: error.message }

    revalidatePath('/animals')
    revalidatePath(`/animals/${id}`)
    revalidatePath('/pound')
    revalidatePath('/dashboard')
    return { data: animal }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function deleteAnimal(id: string) {
  try {
    const { establishmentId } = await requirePermission('manage_animals')
    const supabase = await createClient()

    const { error } = await supabase
      .from('animals')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId)

    if (error) return { error: error.message }

    revalidatePath('/animals')
    revalidatePath('/pound')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function recordMovement(animalId: string, data: {
  type: string
  notes?: string | null
  person_name?: string | null
  person_contact?: string | null
  destination?: string | null
}) {
  try {
    const { establishmentId, userId } = await requirePermission('manage_movements')
    const supabase = await createClient()

    // Verifier que l'animal appartient a l'etablissement
    const { data: animal, error: animalErr } = await supabase
      .from('animals')
      .select('id, status')
      .eq('id', animalId)
      .eq('establishment_id', establishmentId)
      .single()

    if (animalErr || !animal) return { error: 'Animal non trouve' }

    // Enregistrer le mouvement
    const { error: mvtErr } = await supabase.from('animal_movements').insert({
      animal_id: animalId,
      type: data.type,
      date: new Date().toISOString(),
      notes: data.notes,
      person_name: data.person_name,
      person_contact: data.person_contact,
      destination: data.destination,
      created_by: userId,
    })

    if (mvtErr) return { error: mvtErr.message }

    // Mettre a jour le statut de l'animal selon le type de mouvement
    const statusMap: Record<string, AnimalStatus> = {
      shelter_transfer: 'shelter',
      adoption: 'adopted',
      return_to_owner: 'returned',
      transfer_out: 'transferred',
      death: 'deceased',
      euthanasia: 'euthanized',
    }

    const newStatus = statusMap[data.type]
    if (newStatus) {
      const updateData: Record<string, unknown> = { status: newStatus }
      if (data.type === 'shelter_transfer') {
        updateData.shelter_entry_date = new Date().toISOString()
      }
      if (['adoption', 'return_to_owner', 'transfer_out', 'death', 'euthanasia'].includes(data.type)) {
        updateData.exit_date = new Date().toISOString()
      }

      await supabase
        .from('animals')
        .update(updateData)
        .eq('id', animalId)
    }

    revalidatePath('/animals')
    revalidatePath(`/animals/${animalId}`)
    revalidatePath('/pound')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getPoundAnimals() {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('animals')
      .select('*, animal_photos(id, url, is_primary), boxes(name)')
      .eq('establishment_id', establishmentId)
      .eq('status', 'pound')
      .order('pound_entry_date', { ascending: true })

    if (error) return { error: error.message }
    return { data: data || [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function getShelterAnimals() {
  try {
    const { establishmentId } = await requireEstablishment()
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('animals')
      .select('*, animal_photos(id, url, is_primary), boxes(name)')
      .eq('establishment_id', establishmentId)
      .eq('status', 'shelter')
      .order('shelter_entry_date', { ascending: false })

    if (error) return { error: error.message }
    return { data: data || [] }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/actions/animals.ts
git commit -m "feat(sda): add server actions for animals CRUD and movements"
```

---

## Task 6 : Utilitaires SDA

**Files:**
- Create: `src/lib/sda-utils.ts`

**Step 1: Creer les fonctions utilitaires**

```typescript
import type { AnimalSpecies, AnimalSex, AnimalStatus, AnimalOrigin, MovementType, HealthRecordType } from '@/lib/types/database'

export function getSpeciesLabel(species: AnimalSpecies): string {
  const labels: Record<AnimalSpecies, string> = {
    cat: 'Chat',
    dog: 'Chien',
  }
  return labels[species] || species
}

export function getSexLabel(sex: AnimalSex): string {
  const labels: Record<AnimalSex, string> = {
    male: 'Male',
    female: 'Femelle',
    unknown: 'Inconnu',
  }
  return labels[sex] || sex
}

export function getSexIcon(sex: AnimalSex): string {
  const icons: Record<AnimalSex, string> = {
    male: '\u2642',
    female: '\u2640',
    unknown: '?',
  }
  return icons[sex] || '?'
}

export function getStatusLabel(status: AnimalStatus): string {
  const labels: Record<AnimalStatus, string> = {
    pound: 'Fourriere',
    shelter: 'Refuge',
    adopted: 'Adopte',
    returned: 'Restitue',
    transferred: 'Transfere',
    deceased: 'Decede',
    euthanized: 'Euthanasie',
  }
  return labels[status] || status
}

export function getStatusColor(status: AnimalStatus): string {
  const colors: Record<AnimalStatus, string> = {
    pound: 'bg-warning/15 text-warning',
    shelter: 'bg-info/15 text-info',
    adopted: 'bg-success/15 text-success',
    returned: 'bg-success/15 text-success',
    transferred: 'bg-secondary/15 text-secondary',
    deceased: 'bg-error/15 text-error',
    euthanized: 'bg-error/15 text-error',
  }
  return colors[status] || 'bg-muted/15 text-muted'
}

export function getOriginLabel(origin: AnimalOrigin): string {
  const labels: Record<AnimalOrigin, string> = {
    found: 'Trouve',
    abandoned: 'Abandonne',
    transferred_in: 'Transfere (entrant)',
    surrender: 'Remis volontairement',
  }
  return labels[origin] || origin
}

export function getMovementLabel(type: MovementType): string {
  const labels: Record<MovementType, string> = {
    pound_entry: 'Entree en fourriere',
    shelter_transfer: 'Transfert en refuge',
    adoption: 'Adoption',
    return_to_owner: 'Restitution au proprietaire',
    transfer_out: 'Transfert vers autre refuge',
    death: 'Deces',
    euthanasia: 'Euthanasie',
  }
  return labels[type] || type
}

export function getHealthTypeLabel(type: HealthRecordType): string {
  const labels: Record<HealthRecordType, string> = {
    vaccination: 'Vaccination',
    sterilization: 'Sterilisation',
    antiparasitic: 'Antiparasitaire',
    consultation: 'Consultation',
    surgery: 'Chirurgie',
    medication: 'Medicament',
    behavioral_assessment: 'Bilan comportemental',
  }
  return labels[type] || type
}

export function calculateAge(birthDate: string | null): string {
  if (!birthDate) return 'Age inconnu'
  const birth = new Date(birthDate)
  const now = new Date()
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (months < 1) return 'Moins d\'1 mois'
  if (months < 12) return `${months} mois`
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  if (remainingMonths === 0) return `${years} an${years > 1 ? 's' : ''}`
  return `${years} an${years > 1 ? 's' : ''} et ${remainingMonths} mois`
}

export function calculateBusinessDays(startDate: string, endDate?: string): number {
  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : new Date()
  let count = 0
  const current = new Date(start)
  current.setDate(current.getDate() + 1)

  while (current <= end) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }
  return count
}
```

**Step 2: Commit**

```bash
git add src/lib/sda-utils.ts
git commit -m "feat(sda): add utility functions for animal labels, status, age calculation"
```

---

## Task 7 : Page liste des animaux

**Files:**
- Create: `src/app/(app)/animals/page.tsx`
- Create: `src/components/animals/animal-list.tsx`
- Create: `src/components/animals/animal-status-badge.tsx`

**Step 1: Creer le composant badge de statut**

Creer `src/components/animals/animal-status-badge.tsx` :

```typescript
import { getStatusLabel, getStatusColor, getSpeciesLabel } from '@/lib/sda-utils'
import type { AnimalStatus, AnimalSpecies } from '@/lib/types/database'

export function AnimalStatusBadge({ status }: { status: AnimalStatus }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(status)}`}>
      {getStatusLabel(status)}
    </span>
  )
}

export function SpeciesBadge({ species }: { species: AnimalSpecies }) {
  const color = species === 'cat' ? 'bg-purple-500/15 text-purple-600' : 'bg-amber-500/15 text-amber-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {getSpeciesLabel(species)}
    </span>
  )
}
```

**Step 2: Creer le composant liste**

Creer `src/components/animals/animal-list.tsx` :

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimalStatusBadge, SpeciesBadge } from './animal-status-badge'
import { getSexIcon, calculateAge } from '@/lib/sda-utils'
import type { Animal, AnimalPhoto } from '@/lib/types/database'

type AnimalWithPhotos = Animal & { animal_photos: AnimalPhoto[] }

interface AnimalListProps {
  initialData: AnimalWithPhotos[]
}

export function AnimalList({ initialData }: AnimalListProps) {
  const [animals] = useState(initialData)
  const [search, setSearch] = useState('')
  const [speciesFilter, setSpeciesFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filtered = animals.filter(a => {
    if (search) {
      const s = search.toLowerCase()
      if (!a.name.toLowerCase().includes(s) && !a.chip_number?.toLowerCase().includes(s) && !a.medal_number?.toLowerCase().includes(s)) {
        return false
      }
    }
    if (speciesFilter && a.species !== speciesFilter) return false
    if (statusFilter && a.status !== statusFilter) return false
    return true
  })

  return (
    <div>
      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Rechercher (nom, puce, medaille)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <select
          value={speciesFilter}
          onChange={(e) => setSpeciesFilter(e.target.value)}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-sm"
        >
          <option value="">Toutes especes</option>
          <option value="cat">Chats</option>
          <option value="dog">Chiens</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-sm"
        >
          <option value="">Tous statuts</option>
          <option value="pound">Fourriere</option>
          <option value="shelter">Refuge</option>
          <option value="adopted">Adopte</option>
          <option value="returned">Restitue</option>
          <option value="transferred">Transfere</option>
          <option value="deceased">Decede</option>
          <option value="euthanized">Euthanasie</option>
        </select>
      </div>

      {/* Grille */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((animal) => {
          const primaryPhoto = animal.animal_photos?.find(p => p.is_primary) || animal.animal_photos?.[0]
          return (
            <Link
              key={animal.id}
              href={`/animals/${animal.id}`}
              className="bg-surface rounded-xl border border-border overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all group"
            >
              {/* Photo */}
              <div className="aspect-square bg-surface-hover relative overflow-hidden">
                {primaryPhoto ? (
                  <img
                    src={primaryPhoto.url}
                    alt={animal.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl text-muted">
                    {animal.species === 'cat' ? '🐱' : '🐶'}
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <AnimalStatusBadge status={animal.status} />
                </div>
              </div>

              {/* Infos */}
              <div className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{getSexIcon(animal.sex)} {animal.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <SpeciesBadge species={animal.species} />
                  {animal.breed && <span>{animal.breed}</span>}
                </div>
                <p className="text-xs text-muted mt-1">{calculateAge(animal.birth_date)}</p>
                {animal.chip_number && (
                  <p className="text-xs text-muted mt-1 truncate">Puce: {animal.chip_number}</p>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted py-12">Aucun animal trouve</p>
      )}
    </div>
  )
}
```

**Step 3: Creer la page**

Creer `src/app/(app)/animals/page.tsx` :

```typescript
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { AnimalList } from '@/components/animals/animal-list'
import { PawPrint, Plus } from 'lucide-react'

export default async function AnimalsPage() {
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const admin = createAdminClient()

  const { data: animals } = await admin
    .from('animals')
    .select('*, animal_photos(id, url, is_primary)')
    .eq('establishment_id', estabId)
    .order('created_at', { ascending: false })

  const canCreate = ctx!.permissions.canManageAnimals

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <PawPrint className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Animaux</h1>
            <p className="text-sm text-muted mt-1">{(animals || []).length} animal(aux) enregistre(s)</p>
          </div>
        </div>
        {canCreate && (
          <Link
            href="/animals/nouveau"
            className="flex items-center gap-2 px-4 py-2 gradient-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Nouvel animal
          </Link>
        )}
      </div>

      <AnimalList initialData={animals || []} />
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add src/app/\(app\)/animals/page.tsx src/components/animals/animal-list.tsx src/components/animals/animal-status-badge.tsx
git commit -m "feat(sda): add animals list page with filters and grid view"
```

---

## Task 8 : Formulaire creation animal

**Files:**
- Create: `src/components/animals/animal-form.tsx`
- Create: `src/app/(app)/animals/nouveau/page.tsx`

**Step 1: Creer le formulaire**

Creer `src/components/animals/animal-form.tsx` :

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createAnimal, updateAnimal } from '@/lib/actions/animals'
import type { Animal, AnimalSpecies, AnimalSex, AnimalOrigin, Box } from '@/lib/types/database'

interface AnimalFormProps {
  animal?: Animal
  boxes?: Box[]
}

export function AnimalForm({ animal, boxes = [] }: AnimalFormProps) {
  const isEditing = !!animal
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(animal?.name || '')
  const [species, setSpecies] = useState<AnimalSpecies>(animal?.species || 'cat')
  const [sex, setSex] = useState<AnimalSex>(animal?.sex || 'unknown')
  const [originType, setOriginType] = useState<AnimalOrigin>(animal?.origin_type || 'found')
  const [breed, setBreed] = useState(animal?.breed || '')
  const [breedCross, setBreedCross] = useState(animal?.breed_cross || '')
  const [birthDate, setBirthDate] = useState(animal?.birth_date || '')
  const [birthPlace, setBirthPlace] = useState(animal?.birth_place || '')
  const [color, setColor] = useState(animal?.color || '')
  const [weight, setWeight] = useState(animal?.weight?.toString() || '')
  const [chipNumber, setChipNumber] = useState(animal?.chip_number || '')
  const [tattooNumber, setTattooNumber] = useState(animal?.tattoo_number || '')
  const [tattooPosition, setTattooPosition] = useState(animal?.tattoo_position || '')
  const [medalNumber, setMedalNumber] = useState(animal?.medal_number || '')
  const [loofNumber, setLoofNumber] = useState(animal?.loof_number || '')
  const [passportNumber, setPassportNumber] = useState(animal?.passport_number || '')
  const [behaviorScore, setBehaviorScore] = useState(animal?.behavior_score?.toString() || '')
  const [description, setDescription] = useState(animal?.description || '')
  const [captureLocation, setCaptureLocation] = useState(animal?.capture_location || '')
  const [captureCircumstances, setCaptureCircumstances] = useState(animal?.capture_circumstances || '')
  const [boxId, setBoxId] = useState(animal?.box_id || '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const formData = {
      name,
      species,
      sex,
      origin_type: originType,
      breed: breed || null,
      breed_cross: breedCross || null,
      birth_date: birthDate || null,
      birth_place: birthPlace || null,
      color: color || null,
      weight: weight ? parseFloat(weight) : null,
      chip_number: chipNumber || null,
      tattoo_number: tattooNumber || null,
      tattoo_position: tattooPosition || null,
      medal_number: medalNumber || null,
      loof_number: loofNumber || null,
      passport_number: passportNumber || null,
      behavior_score: behaviorScore ? parseInt(behaviorScore) : null,
      description: description || null,
      capture_location: captureLocation || null,
      capture_circumstances: captureCircumstances || null,
      box_id: boxId || null,
    }

    startTransition(async () => {
      const result = isEditing
        ? await updateAnimal(animal!.id, formData)
        : await createAnimal(formData)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(isEditing ? 'Animal mis a jour' : 'Animal enregistre')
        if (!isEditing && result.data) {
          router.push(`/animals/${result.data.id}`)
        }
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-sm font-medium mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section: Identite */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="font-semibold mb-4">Identite</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>Nom *</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="Nom de l'animal" />
          </div>
          <div>
            <label className={labelClass}>Espece *</label>
            <select value={species} onChange={e => setSpecies(e.target.value as AnimalSpecies)} className={inputClass}>
              <option value="cat">Chat</option>
              <option value="dog">Chien</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Sexe *</label>
            <select value={sex} onChange={e => setSex(e.target.value as AnimalSex)} className={inputClass}>
              <option value="unknown">Inconnu</option>
              <option value="male">Male</option>
              <option value="female">Femelle</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Origine *</label>
            <select value={originType} onChange={e => setOriginType(e.target.value as AnimalOrigin)} className={inputClass}>
              <option value="found">Trouve</option>
              <option value="abandoned">Abandonne</option>
              <option value="transferred_in">Transfere (entrant)</option>
              <option value="surrender">Remis volontairement</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Race</label>
            <input type="text" value={breed} onChange={e => setBreed(e.target.value)} className={inputClass} placeholder="Ex: Europeen" />
          </div>
          <div>
            <label className={labelClass}>Race de croisement</label>
            <input type="text" value={breedCross} onChange={e => setBreedCross(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Date de naissance</label>
            <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Lieu de naissance</label>
            <input type="text" value={birthPlace} onChange={e => setBirthPlace(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Couleur / Pelage</label>
            <input type="text" value={color} onChange={e => setColor(e.target.value)} className={inputClass} placeholder="Ex: Tigre gris" />
          </div>
          <div>
            <label className={labelClass}>Poids (kg)</label>
            <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Score comportement (1-5)</label>
            <select value={behaviorScore} onChange={e => setBehaviorScore(e.target.value)} className={inputClass}>
              <option value="">Non evalue</option>
              <option value="1">1 - Difficile</option>
              <option value="2">2</option>
              <option value="3">3 - Moyen</option>
              <option value="4">4</option>
              <option value="5">5 - Excellent</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Box</label>
            <select value={boxId} onChange={e => setBoxId(e.target.value)} className={inputClass}>
              <option value="">Aucun box</option>
              {boxes.filter(b => b.status !== 'maintenance').map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.species_type})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className={labelClass}>Description / Caractere</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={inputClass} placeholder="Temperament, habitudes, entente avec autres animaux..." />
        </div>
      </div>

      {/* Section: Identification */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="font-semibold mb-4">Identification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>N° de puce</label>
            <input type="text" value={chipNumber} onChange={e => setChipNumber(e.target.value)} className={inputClass} placeholder="250XXXXXXXXXXXX" />
          </div>
          <div>
            <label className={labelClass}>N° de tatouage</label>
            <input type="text" value={tattooNumber} onChange={e => setTattooNumber(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Position du tatouage</label>
            <input type="text" value={tattooPosition} onChange={e => setTattooPosition(e.target.value)} className={inputClass} placeholder="Oreille droite" />
          </div>
          <div>
            <label className={labelClass}>N° de medaille</label>
            <input type="text" value={medalNumber} onChange={e => setMedalNumber(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>N° LOOF</label>
            <input type="text" value={loofNumber} onChange={e => setLoofNumber(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>N° Passeport</label>
            <input type="text" value={passportNumber} onChange={e => setPassportNumber(e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Section: Capture / Origine */}
      {!isEditing && (
        <div className="bg-surface rounded-xl border border-border p-5">
          <h3 className="font-semibold mb-4">Lieu de capture / Origine</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Lieu de capture / recuperation</label>
              <input type="text" value={captureLocation} onChange={e => setCaptureLocation(e.target.value)} className={inputClass} placeholder="Ex: Rue de la Gare, Estourmel" />
            </div>
            <div>
              <label className={labelClass}>Circonstances</label>
              <textarea value={captureCircumstances} onChange={e => setCaptureCircumstances(e.target.value)} rows={2} className={inputClass} placeholder="Circonstances de la capture..." />
            </div>
          </div>
        </div>
      )}

      {/* Bouton */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm text-muted hover:text-text transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2 gradient-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? 'Enregistrement...' : isEditing ? 'Mettre a jour' : 'Enregistrer l\'animal'}
        </button>
      </div>
    </form>
  )
}
```

**Step 2: Creer la page nouveau**

Creer `src/app/(app)/animals/nouveau/page.tsx` :

```typescript
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { AnimalForm } from '@/components/animals/animal-form'

export default async function NouvelAnimalPage() {
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const admin = createAdminClient()

  const { data: boxes } = await admin
    .from('boxes')
    .select('*')
    .eq('establishment_id', estabId)
    .order('name')

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/animals" className="text-muted hover:text-text transition-colors">
          &larr; Retour
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nouvel animal</h1>
          <p className="text-sm text-muted mt-1">Enregistrer un animal entrant</p>
        </div>
      </div>

      <AnimalForm boxes={boxes || []} />
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/components/animals/animal-form.tsx src/app/\(app\)/animals/nouveau/page.tsx
git commit -m "feat(sda): add animal creation form with all fields"
```

---

## Task 9 : Page detail animal avec onglets

**Files:**
- Create: `src/app/(app)/animals/[id]/page.tsx`

**Step 1: Creer la page detail**

Creer `src/app/(app)/animals/[id]/page.tsx` :

```typescript
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { AnimalStatusBadge, SpeciesBadge } from '@/components/animals/animal-status-badge'
import { AnimalForm } from '@/components/animals/animal-form'
import { getSexIcon, calculateAge, getOriginLabel, getMovementLabel, getHealthTypeLabel } from '@/lib/sda-utils'
import { formatDateShort, formatCurrency } from '@/lib/utils'
import type { Animal, AnimalPhoto, AnimalMovement, AnimalHealthRecord, Box } from '@/lib/types/database'

export default async function AnimalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const admin = createAdminClient()

  const [
    { data: animal },
    { data: photos },
    { data: movements },
    { data: healthRecords },
    { data: boxes },
  ] = await Promise.all([
    admin.from('animals').select('*').eq('id', id).eq('establishment_id', estabId).single(),
    admin.from('animal_photos').select('*').eq('animal_id', id).order('is_primary', { ascending: false }),
    admin.from('animal_movements').select('*').eq('animal_id', id).order('date', { ascending: false }),
    admin.from('animal_health_records').select('*').eq('animal_id', id).order('date', { ascending: false }),
    admin.from('boxes').select('*').eq('establishment_id', estabId).order('name'),
  ])

  if (!animal) notFound()

  const typedAnimal = animal as Animal
  const typedPhotos = (photos as AnimalPhoto[]) || []
  const typedMovements = (movements as AnimalMovement[]) || []
  const typedHealth = (healthRecords as AnimalHealthRecord[]) || []
  const typedBoxes = (boxes as Box[]) || []
  const primaryPhoto = typedPhotos.find(p => p.is_primary) || typedPhotos[0]
  const canEdit = ctx!.permissions.canManageAnimals

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/animals" className="text-muted hover:text-text transition-colors">&larr; Retour</Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{getSexIcon(typedAnimal.sex)} {typedAnimal.name}</h1>
            <AnimalStatusBadge status={typedAnimal.status} />
            <SpeciesBadge species={typedAnimal.species} />
          </div>
          <p className="text-sm text-muted mt-1">
            {typedAnimal.breed || 'Race inconnue'} - {calculateAge(typedAnimal.birth_date)} - {getOriginLabel(typedAnimal.origin_type)}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Colonne gauche: Photo + infos rapides */}
        <div className="space-y-4">
          {/* Photo */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="aspect-square bg-surface-hover">
              {primaryPhoto ? (
                <img src={primaryPhoto.url} alt={typedAnimal.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl text-muted">
                  {typedAnimal.species === 'cat' ? '🐱' : '🐶'}
                </div>
              )}
            </div>
            {typedPhotos.length > 1 && (
              <div className="p-2 flex gap-2 overflow-x-auto">
                {typedPhotos.map(p => (
                  <img key={p.id} src={p.url} alt="" className="w-16 h-16 rounded object-cover shrink-0" />
                ))}
              </div>
            )}
          </div>

          {/* Identification */}
          <div className="bg-surface rounded-xl border border-border p-4 space-y-2 text-sm">
            <h3 className="font-semibold mb-3">Identification</h3>
            {typedAnimal.chip_number && <p><span className="text-muted">Puce:</span> {typedAnimal.chip_number}</p>}
            {typedAnimal.medal_number && <p><span className="text-muted">Medaille:</span> {typedAnimal.medal_number}</p>}
            {typedAnimal.tattoo_number && <p><span className="text-muted">Tatouage:</span> {typedAnimal.tattoo_number} ({typedAnimal.tattoo_position})</p>}
            {typedAnimal.loof_number && <p><span className="text-muted">LOOF:</span> {typedAnimal.loof_number}</p>}
            {typedAnimal.passport_number && <p><span className="text-muted">Passeport:</span> {typedAnimal.passport_number}</p>}
            <p><span className="text-muted">I-CAD:</span> {typedAnimal.icad_updated ? '✅ A jour' : '⏳ A mettre a jour'}</p>
          </div>

          {/* Capture */}
          {typedAnimal.capture_location && (
            <div className="bg-surface rounded-xl border border-border p-4 text-sm">
              <h3 className="font-semibold mb-3">Origine</h3>
              <p><span className="text-muted">Lieu:</span> {typedAnimal.capture_location}</p>
              {typedAnimal.capture_circumstances && <p className="mt-1 text-muted">{typedAnimal.capture_circumstances}</p>}
            </div>
          )}

          {/* Description */}
          {typedAnimal.description && (
            <div className="bg-surface rounded-xl border border-border p-4 text-sm">
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted">{typedAnimal.description}</p>
            </div>
          )}
        </div>

        {/* Colonne droite: Onglets */}
        <div className="lg:col-span-2 space-y-6">
          {/* Mouvements */}
          <div className="bg-surface rounded-xl border border-border">
            <div className="p-5 border-b border-border">
              <h3 className="font-semibold">Historique des mouvements</h3>
            </div>
            {typedMovements.length === 0 ? (
              <p className="p-5 text-sm text-muted text-center">Aucun mouvement enregistre</p>
            ) : (
              <div className="divide-y divide-border">
                {typedMovements.map(m => (
                  <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{getMovementLabel(m.type)}</p>
                      {m.person_name && <p className="text-xs text-muted">Par: {m.person_name}</p>}
                      {m.notes && <p className="text-xs text-muted">{m.notes}</p>}
                    </div>
                    <span className="text-xs text-muted">{formatDateShort(m.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sante */}
          <div className="bg-surface rounded-xl border border-border">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Suivi sante</h3>
            </div>
            {typedHealth.length === 0 ? (
              <p className="p-5 text-sm text-muted text-center">Aucun acte de sante enregistre</p>
            ) : (
              <div className="divide-y divide-border">
                {typedHealth.map(h => (
                  <div key={h.id} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-info/15 text-info">{getHealthTypeLabel(h.type)}</span>
                        <span className="text-sm ml-2">{h.description}</span>
                      </div>
                      <span className="text-xs text-muted">{formatDateShort(h.date)}</span>
                    </div>
                    {h.veterinarian && <p className="text-xs text-muted mt-1">Dr. {h.veterinarian}</p>}
                    {h.cost && <p className="text-xs text-muted">Cout: {formatCurrency(h.cost)}</p>}
                    {h.next_due_date && <p className="text-xs text-warning">Prochain rappel: {formatDateShort(h.next_due_date)}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Edition */}
          {canEdit && (
            <details className="bg-surface rounded-xl border border-border">
              <summary className="p-5 cursor-pointer font-semibold hover:text-primary transition-colors">
                Modifier la fiche
              </summary>
              <div className="px-5 pb-5">
                <AnimalForm animal={typedAnimal} boxes={typedBoxes} />
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/animals/\[id\]/page.tsx
git commit -m "feat(sda): add animal detail page with movements and health history"
```

---

## Task 10 : Page fourriere avec compteur de jours

**Files:**
- Create: `src/app/(app)/pound/page.tsx`

**Step 1: Creer la page fourriere**

Creer `src/app/(app)/pound/page.tsx` :

```typescript
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { AnimalStatusBadge, SpeciesBadge } from '@/components/animals/animal-status-badge'
import { getSexIcon, calculateAge, calculateBusinessDays, getOriginLabel } from '@/lib/sda-utils'
import { Warehouse, AlertTriangle } from 'lucide-react'
import type { Animal, AnimalPhoto } from '@/lib/types/database'

type AnimalWithPhotos = Animal & { animal_photos: AnimalPhoto[] }

function DaysCounter({ days }: { days: number }) {
  const color = days >= 7 ? 'bg-error text-white' : days >= 5 ? 'bg-warning text-white' : 'bg-info text-white'
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${color}`}>
      {days}
    </span>
  )
}

export default async function PoundPage() {
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const admin = createAdminClient()

  const { data: animals } = await admin
    .from('animals')
    .select('*, animal_photos(id, url, is_primary)')
    .eq('establishment_id', estabId)
    .eq('status', 'pound')
    .order('pound_entry_date', { ascending: true })

  const poundAnimals = ((animals as AnimalWithPhotos[]) || []).map(a => ({
    ...a,
    businessDays: a.pound_entry_date ? calculateBusinessDays(a.pound_entry_date) : 0,
  }))

  const alertAnimals = poundAnimals.filter(a => a.businessDays >= 6)

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <Warehouse className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Fourriere</h1>
          <p className="text-sm text-muted mt-1">{poundAnimals.length} animal(aux) en fourriere</p>
        </div>
      </div>

      {/* Alertes */}
      {alertAnimals.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <h3 className="font-semibold text-warning">Fin de fourriere imminente</h3>
          </div>
          <ul className="space-y-1">
            {alertAnimals.map(a => (
              <li key={a.id} className="text-sm">
                <Link href={`/animals/${a.id}`} className="text-warning hover:underline font-medium">
                  {a.name}
                </Link>
                {' '}- Jour {a.businessDays}/8
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tableau */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-hover/50">
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Animal</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Identification</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Origine</th>
              <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Lieu de capture</th>
              <th className="text-center px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Jours ouvres</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {poundAnimals.map(a => {
              const photo = a.animal_photos?.find((p: AnimalPhoto) => p.is_primary) || a.animal_photos?.[0]
              return (
                <tr key={a.id} className="hover:bg-surface-hover/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/animals/${a.id}`} className="flex items-center gap-3 hover:text-primary transition-colors">
                      {photo ? (
                        <img src={photo.url} alt={a.name} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center text-lg">
                          {a.species === 'cat' ? '🐱' : '🐶'}
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{getSexIcon(a.sex)} {a.name}</p>
                        <div className="flex items-center gap-1">
                          <SpeciesBadge species={a.species} />
                          <span className="text-xs text-muted">{a.breed} - {calculateAge(a.birth_date)}</span>
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {a.chip_number ? <span>Puce: {a.chip_number}</span> : <span className="text-warning">Non identifie</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">{getOriginLabel(a.origin_type)}</td>
                  <td className="px-4 py-3 text-muted">{a.capture_location || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <DaysCounter days={a.businessDays} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {poundAnimals.length === 0 && (
          <p className="p-8 text-center text-muted">Aucun animal en fourriere actuellement</p>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/pound/page.tsx
git commit -m "feat(sda): add pound page with business days counter and alerts"
```

---

## Task 11 : Dashboard refuge

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

**Step 1: Conditionner le dashboard selon le type d'etablissement**

Dans `src/app/(app)/dashboard/page.tsx`, ajouter apres les fetches existants une section conditionnelle. Envelopper le contenu actuel dans un `if (ctx.establishment.type === 'farm' || ctx.establishment.type === 'both')` et ajouter un dashboard refuge pour `shelter` ou `both`.

Le dashboard refuge affiche :
- Compteur animaux en fourriere
- Compteur animaux en refuge
- Adoptions du mois
- Restitutions du mois
- Alertes (fin fourriere imminente, rappels vaccins)
- Dernieres entrees

Logique : Creer un composant `ShelterDashboard` dans `src/components/dashboard/shelter-dashboard.tsx` qui recoit les stats et les affiche.

**Step 2: Creer le composant ShelterDashboard**

Creer `src/components/dashboard/shelter-dashboard.tsx` :

```typescript
import Link from 'next/link'
import { PawPrint, Warehouse, HeartPulse, Home, AlertTriangle } from 'lucide-react'
import { AnimalStatusBadge, SpeciesBadge } from '@/components/animals/animal-status-badge'
import { getSexIcon, calculateAge, calculateBusinessDays } from '@/lib/sda-utils'
import { formatDateShort } from '@/lib/utils'
import type { Animal, AnimalPhoto } from '@/lib/types/database'

type AnimalWithPhotos = Animal & { animal_photos: AnimalPhoto[] }

interface ShelterStats {
  poundCount: number
  shelterCount: number
  adoptionsThisMonth: number
  restitutionsThisMonth: number
}

interface ShelterDashboardProps {
  stats: ShelterStats
  poundAnimals: AnimalWithPhotos[]
  recentAnimals: AnimalWithPhotos[]
  healthAlerts: { animal_name: string; animal_id: string; description: string; next_due_date: string }[]
  userEmail: string
}

export function ShelterDashboard({ stats, poundAnimals, recentAnimals, healthAlerts, userEmail }: ShelterDashboardProps) {
  const alertAnimals = poundAnimals
    .map(a => ({ ...a, days: a.pound_entry_date ? calculateBusinessDays(a.pound_entry_date) : 0 }))
    .filter(a => a.days >= 6)

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-sm text-muted mt-1">SDA Estormel</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/15 flex items-center justify-center">
              <Warehouse className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.poundCount}</p>
              <p className="text-xs text-muted">En fourriere</p>
            </div>
          </div>
        </div>
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-info/15 flex items-center justify-center">
              <PawPrint className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.shelterCount}</p>
              <p className="text-xs text-muted">En refuge</p>
            </div>
          </div>
        </div>
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/15 flex items-center justify-center">
              <Home className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.adoptionsThisMonth}</p>
              <p className="text-xs text-muted">Adoptions ce mois</p>
            </div>
          </div>
        </div>
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary/15 flex items-center justify-center">
              <HeartPulse className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.restitutionsThisMonth}</p>
              <p className="text-xs text-muted">Restitutions ce mois</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Alertes */}
        <div className="space-y-4">
          {alertAnimals.length > 0 && (
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <h3 className="font-semibold text-warning">Fin de fourriere imminente</h3>
              </div>
              {alertAnimals.map(a => (
                <Link key={a.id} href={`/animals/${a.id}`} className="block text-sm py-1 hover:text-warning transition-colors">
                  {a.name} - Jour {a.days}/8
                </Link>
              ))}
            </div>
          )}

          {healthAlerts.length > 0 && (
            <div className="bg-info/10 border border-info/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <HeartPulse className="w-5 h-5 text-info" />
                <h3 className="font-semibold text-info">Soins a prevoir</h3>
              </div>
              {healthAlerts.slice(0, 5).map((h, i) => (
                <Link key={i} href={`/animals/${h.animal_id}`} className="block text-sm py-1 hover:text-info transition-colors">
                  {h.animal_name} - {h.description} (rappel {formatDateShort(h.next_due_date)})
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Dernieres entrees */}
        <div className="bg-surface rounded-xl border border-border">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h3 className="font-semibold">Dernieres entrees</h3>
            <Link href="/animals" className="text-sm text-primary hover:text-primary-light transition-colors">Voir tout</Link>
          </div>
          <div className="divide-y divide-border">
            {recentAnimals.slice(0, 5).map(a => {
              const photo = a.animal_photos?.find(p => p.is_primary) || a.animal_photos?.[0]
              return (
                <Link key={a.id} href={`/animals/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover transition-colors">
                  {photo ? (
                    <img src={photo.url} alt={a.name} className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center">
                      {a.species === 'cat' ? '🐱' : '🐶'}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{getSexIcon(a.sex)} {a.name}</p>
                    <p className="text-xs text-muted">{calculateAge(a.birth_date)}</p>
                  </div>
                  <AnimalStatusBadge status={a.status} />
                </Link>
              )
            })}
            {recentAnimals.length === 0 && (
              <p className="p-5 text-sm text-muted text-center">Aucun animal enregistre</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Modifier le dashboard page pour charger conditionnellement**

Dans `src/app/(app)/dashboard/page.tsx`, ajouter l'import du ShelterDashboard et un branchement sur `ctx.establishment.type`. Si `shelter` ou `both`, charger les stats refuge et afficher le ShelterDashboard. Si `farm`, garder le dashboard existant.

**Step 4: Commit**

```bash
git add src/components/dashboard/shelter-dashboard.tsx src/app/\(app\)/dashboard/page.tsx
git commit -m "feat(sda): add shelter dashboard with stats, alerts, and recent entries"
```

---

## Task 12 : Page gestion des box

**Files:**
- Create: `src/lib/actions/boxes.ts`
- Create: `src/app/(app)/boxes/page.tsx`

**Step 1: Server actions pour les box**

Creer `src/lib/actions/boxes.ts` suivant le meme pattern que `animals.ts` : CRUD complet (getBoxes, createBox, updateBox, deleteBox) avec permission `manage_boxes`.

**Step 2: Page box avec grille visuelle**

Creer `src/app/(app)/boxes/page.tsx` qui affiche les box sous forme de cartes avec :
- Nom du box, type d'espece, capacite
- Statut (disponible/occupe/maintenance) avec couleur
- Animal(aux) present(s) si occupe (lien vers fiche)
- Actions : modifier statut, assigner animal

**Step 3: Commit**

```bash
git add src/lib/actions/boxes.ts src/app/\(app\)/boxes/page.tsx
git commit -m "feat(sda): add box management page with visual grid"
```

---

## Task 13 : Server actions sante et page sante globale

**Files:**
- Create: `src/lib/actions/health.ts`
- Create: `src/app/(app)/health/page.tsx`

**Step 1: Server actions sante**

Creer `src/lib/actions/health.ts` : CRUD pour `animal_health_records` avec permission `manage_health`. Inclure `getUpcomingReminders()` qui retourne les rappels vaccins/soins a venir dans les 7 prochains jours.

**Step 2: Page sante globale**

Creer `src/app/(app)/health/page.tsx` qui affiche :
- Rappels a venir (prochains 7 jours) en haut
- Derniers actes de sante (tous animaux confondus)
- Filtres par type d'acte et par animal
- Lien rapide vers la fiche animal

**Step 3: Commit**

```bash
git add src/lib/actions/health.ts src/app/\(app\)/health/page.tsx
git commit -m "feat(sda): add global health page with reminders and records"
```

---

## Recapitulatif des taches

| # | Tache | Fichiers | Estimation |
|---|-------|----------|-----------|
| 1 | Schema SQL | migration SQL | 5 min |
| 2 | Types TypeScript | database.ts | 5 min |
| 3 | Extension permissions | permissions.ts, context.ts | 5 min |
| 4 | Sidebar dynamique | sidebar.tsx | 10 min |
| 5 | Server actions animaux | animals.ts | 10 min |
| 6 | Utilitaires SDA | sda-utils.ts | 5 min |
| 7 | Page liste animaux | page.tsx, animal-list.tsx, badges | 10 min |
| 8 | Formulaire creation | animal-form.tsx, nouveau/page.tsx | 10 min |
| 9 | Page detail animal | [id]/page.tsx | 15 min |
| 10 | Page fourriere | pound/page.tsx | 10 min |
| 11 | Dashboard refuge | shelter-dashboard.tsx, dashboard/page.tsx | 10 min |
| 12 | Gestion des box | boxes actions + page | 10 min |
| 13 | Sante globale | health actions + page | 10 min |
