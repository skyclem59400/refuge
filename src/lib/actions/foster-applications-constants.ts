// Constantes UI pour les candidatures Famille d'Accueil.
// Extrait hors de foster-applications.ts car Next.js 16 + Turbopack
// n'autorise que des async functions dans les fichiers 'use server'.

import type {
  FosterApplicationStatus,
  FosterType,
  HousingType,
} from '@/lib/types/database'

export const FOSTER_STATUS_LABELS: Record<FosterApplicationStatus, string> = {
  pending: 'Nouvelle',
  qualified: 'Qualifiée',
  interview_scheduled: 'Entretien planifié',
  home_visit_scheduled: 'Visite domicile planifiée',
  accepted: 'Acceptée',
  declined: 'Refusée',
  archived: 'Archivée',
}

export const FOSTER_STATUS_CLASSES: Record<FosterApplicationStatus, string> = {
  pending: 'bg-blue-500/15 text-blue-600',
  qualified: 'bg-amber-500/15 text-amber-700',
  interview_scheduled: 'bg-violet-500/15 text-violet-700',
  home_visit_scheduled: 'bg-indigo-500/15 text-indigo-700',
  accepted: 'bg-emerald-500/15 text-emerald-700',
  declined: 'bg-rose-500/15 text-rose-600',
  archived: 'bg-slate-500/15 text-slate-500',
}

export const FOSTER_TYPE_LABELS: Record<FosterType, string> = {
  puppies: 'Chiots',
  kittens: 'Chatons',
  convalescents: 'Convalescents',
  timid: 'Animaux timides',
  emergency: 'Urgences',
  all: 'Tout type',
}

export const HOUSING_TYPE_LABELS: Record<HousingType, string> = {
  house: 'Maison',
  apartment: 'Appartement',
  other: 'Autre',
}
