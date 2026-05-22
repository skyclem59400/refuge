import type { ComponentType } from 'react'
import type { ContractType, EstablishmentType, Permissions, RoleType } from '@/lib/types/database'
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
  Sparkles,
  Ban,
  Clock,
  ClipboardList,
  ShieldCheck,
  AlertCircle,
  FileSignature,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  Icon: ComponentType<{ className?: string }>
  permission?: keyof Permissions
  /** Si défini, limite l'item à ces types de rôle (admin/salarie/benevole) */
  roles?: RoleType[]
  /** Si défini, limite l'item à ces types de contrat. Utile pour les auto-entrepreneurs
   * concernés par le CRA mais qui ne sont pas role_type='salarie'. */
  contractTypes?: ContractType[]
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
      { href: '/adoptions', label: 'Adoptions', Icon: Heart, permission: 'canManageAdoptions' },
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
      { href: '/nouvelles', label: 'Nouvelles', Icon: Sparkles, permission: 'canViewAnimalNews' },
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
      { href: '/espace-collaborateur', label: 'Mon espace', Icon: Briefcase, permission: 'canViewOwnLeaves', contractTypes: ['salarie', 'auto_entrepreneur'] },
      { href: '/espace-collaborateur/cra', label: 'Mes CRA', Icon: ClipboardList, permission: 'canViewOwnLeaves', contractTypes: ['salarie', 'auto_entrepreneur'] },
      { href: '/espace-collaborateur/contrats', label: 'Mes contrats', Icon: FileSignature, permission: 'canViewOwnLeaves', contractTypes: ['salarie', 'auto_entrepreneur'] },
      { href: '/admin/conges', label: 'Congés', Icon: CalendarCheck, permission: 'canManageLeaves' },
      { href: '/admin/cra/saisie', label: 'Saisie CRA', Icon: ClipboardList, permission: 'canManageLeaves' },
      { href: '/admin/cra/horaires', label: 'Horaires de référence', Icon: Clock, permission: 'canManageLeaves' },
      { href: '/admin/cra/validations', label: 'Validations admin CRA', Icon: ShieldCheck, permission: 'canManageEstablishment' },
      { href: '/admin/cra/demandes', label: 'Demandes modif CRA', Icon: AlertCircle, permission: 'canManageLeaves' },
      { href: '/admin/contrats', label: 'Contrats / docs RH', Icon: FileSignature, permission: 'canManagePayslips' },
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
      { href: '/etablissement/liste-noire', label: 'Liste noire', Icon: Ban, permission: 'canManageEstablishment' },
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

function filterItems(
  items: NavItem[],
  permissions: Permissions,
  roleType: RoleType,
  contractType: ContractType | null,
): NavItem[] {
  return items.filter((item) => {
    if (item.permission && !permissions[item.permission]) return false
    if (item.roles && !item.roles.includes(roleType)) return false
    if (item.contractTypes && (!contractType || !item.contractTypes.includes(contractType))) return false
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
  contractType: ContractType | null = null,
): NavSection[] {
  const raw = type === 'farm' ? farmSections : shelterSections
  return raw
    .map((s) => ({ ...s, items: filterItems(s.items, permissions, roleType, contractType) }))
    .filter((s) => s.items.length > 0)
}
