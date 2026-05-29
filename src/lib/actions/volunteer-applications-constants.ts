// Constantes UI pour les candidatures bénévoles.
// Extrait hors de volunteer-applications.ts car Next.js 16 + Turbopack
// n'autorise que des async functions dans les fichiers 'use server'.

import type { VolunteerApplicationStatus, VolunteerSkill } from '@/lib/types/database'

export const VOLUNTEER_STATUS_LABELS: Record<VolunteerApplicationStatus, string> = {
  pending: 'Nouvelle',
  qualified: 'Qualifiée',
  interview_scheduled: 'Entretien planifié',
  accepted: 'Acceptée',
  declined: 'Refusée',
  archived: 'Archivée',
}

export const VOLUNTEER_STATUS_CLASSES: Record<VolunteerApplicationStatus, string> = {
  pending: 'bg-blue-500/15 text-blue-600',
  qualified: 'bg-amber-500/15 text-amber-700',
  interview_scheduled: 'bg-violet-500/15 text-violet-700',
  accepted: 'bg-emerald-500/15 text-emerald-700',
  declined: 'bg-rose-500/15 text-rose-600',
  archived: 'bg-slate-500/15 text-slate-500',
}

export const VOLUNTEER_SKILL_LABELS: Record<VolunteerSkill, string> = {
  dog_walking: 'Promenade des chiens',
  animal_care: 'Soins animaux',
  public_reception: 'Accueil public',
  transport: 'Transport (permis B)',
  grooming: 'Toilettage',
  maintenance: 'Maintenance',
  communication: 'Communication / RS',
  events: 'Événements',
  admin: 'Administratif',
}

export const VOLUNTEER_DAY_LABELS: Record<string, string> = {
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mer',
  thu: 'Jeu',
  fri: 'Ven',
  sat: 'Sam',
  sun: 'Dim',
}

export const VOLUNTEER_SLOT_LABELS: Record<string, string> = {
  morning: 'Matin',
  afternoon: 'Après-midi',
  evening: 'Soir',
}

export const VOLUNTEER_FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Hebdomadaire',
  biweekly: 'Bi-mensuelle',
  monthly: 'Mensuelle',
  occasional: 'Occasionnelle',
}

export const VOLUNTEER_PHYSICAL_LABELS: Record<string, string> = {
  good: 'Bonne',
  limited: 'Limitée',
  restricted: 'Restreinte',
}
