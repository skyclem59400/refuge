import type { ComponentType } from 'react'
import type { EstablishmentType, Permissions, RoleType } from '@/lib/types/database'
import {
  LayoutDashboard,
  FileText,
  Users,
  Building2,
  PawPrint,
  Warehouse,
  HeartPulse,
  Package,
  BarChart3,
  Heart,
  Share2,
  PhoneCall,
  Footprints,
  Scale,
  CalendarDays,
  Briefcase,
  CalendarCheck,
  Inbox,
  Stethoscope,
  Wallet,
  MapPin,
  KeyRound,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  Icon: ComponentType<{ className?: string }>
  permission?: keyof Permissions
  /** Si défini, limite l'item à ces types de rôle */
  roles?: RoleType[]
}

export interface NavSection {
  /** Titre affiché en en-tête de section. Omis pour les items "racine" (ex: Dashboard). */
  label?: string
  items: NavItem[]
}

const shelterSections: NavSection[] = [
  {
    items: [{ href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard }],
  },
  {
    label: 'Animaux',
    items: [
      { href: '/animals', label: 'Animaux', Icon: PawPrint, permission: 'canViewAnimals' },
      { href: '/pound', label: 'Fourrière', Icon: Warehouse, permission: 'canViewPound' },
      { href: '/requisitions', label: 'Réquisition', Icon: Scale, permission: 'canViewAnimals' },
      { href: '/boxes', label: 'Box', Icon: Package, permission: 'canManageBoxes' },
      { href: '/sorties', label: 'Sorties', Icon: Footprints, permission: 'canManageOutings' },
    ],
  },
  {
    label: 'Santé',
    items: [
      { href: '/sante', label: 'Santé', Icon: HeartPulse, permission: 'canManageHealth' },
      { href: '/etablissement/veterinaires', label: 'Praticiens', Icon: Stethoscope, permission: 'canManageVeterinarians' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { href: '/clients', label: 'Répertoire', Icon: Users, permission: 'canManageClients' },
      { href: '/publications', label: 'Publications', Icon: Share2, permission: 'canManagePosts' },
      { href: '/appels', label: 'Appels', Icon: PhoneCall, permission: 'canManageEstablishment' },
      { href: '/contacts-entrants', label: 'Contacts entrants', Icon: Inbox, permission: 'isOwner' },
    ],
  },
  {
    label: 'Finances',
    items: [
      { href: '/documents', label: 'Documents', Icon: FileText, permission: 'canManageDocuments' },
      { href: '/reglements', label: 'Règlements', Icon: Wallet, permission: 'canManageDocuments' },
      { href: '/donations', label: 'Dons', Icon: Heart, permission: 'canManageDonations' },
    ],
  },
  {
    label: 'Équipe',
    items: [
      { href: '/planning', label: 'Planning', Icon: CalendarDays, permission: 'canManageEstablishment' },
      { href: '/espace-collaborateur', label: 'Mon espace', Icon: Briefcase, permission: 'canViewOwnLeaves', roles: ['admin', 'salarie'] },
      { href: '/admin/conges', label: 'Congés', Icon: CalendarCheck, permission: 'canManageLeaves' },
    ],
  },
  {
    label: 'Astreinte',
    items: [
      { href: '/astreinte/tickets', label: 'Tickets', Icon: Inbox, permission: 'canManageEstablishment' },
      { href: '/astreinte/communes', label: 'Communes', Icon: MapPin, permission: 'canManageEstablishment' },
      { href: '/astreinte/acces', label: 'Accès portail', Icon: KeyRound, permission: 'canManageEstablishment' },
    ],
  },
  {
    label: 'Pilotage',
    items: [
      { href: '/statistiques', label: 'Statistiques', Icon: BarChart3, permission: 'canViewStatistics', roles: ['admin', 'salarie'] },
      { href: '/etablissement', label: 'Établissement', Icon: Building2, permission: 'canManageEstablishment' },
    ],
  },
]

const farmSections: NavSection[] = [
  {
    items: [{ href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard }],
  },
  {
    label: 'Activité',
    items: [
      { href: '/documents', label: 'Documents', Icon: FileText, permission: 'canManageDocuments' },
      { href: '/clients', label: 'Répertoire', Icon: Users, permission: 'canManageClients' },
    ],
  },
  {
    label: 'Pilotage',
    items: [
      { href: '/etablissement', label: 'Établissement', Icon: Building2, permission: 'canManageEstablishment' },
      { href: '/admin/conges', label: 'Congés', Icon: CalendarCheck, permission: 'canManageLeaves' },
    ],
  },
]

function filterItems(items: NavItem[], permissions: Permissions, roleType: RoleType): NavItem[] {
  return items.filter((item) => {
    if (item.permission && !permissions[item.permission]) return false
    if (item.roles && !item.roles.includes(roleType)) return false
    return true
  })
}

/**
 * Retourne les sections nav à afficher pour le user courant.
 * Sections vides (tous items filtrés par permissions/rôle) sont retirées.
 */
export function getNavSections(
  type: EstablishmentType,
  permissions: Permissions,
  roleType: RoleType,
): NavSection[] {
  const raw = type === 'farm' ? farmSections : shelterSections
  return raw
    .map((s) => ({ ...s, items: filterItems(s.items, permissions, roleType) }))
    .filter((s) => s.items.length > 0)
}
