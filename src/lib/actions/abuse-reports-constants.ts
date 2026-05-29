// Constantes UI pour les signalements de maltraitance.
// Extrait hors de abuse-reports.ts car Next.js 16 + Turbopack n'autorise
// que des async functions dans les fichiers 'use server'.

import type { AbuseType, AbuseSeverity, AbuseReportStatus, AnimalType } from '@/lib/types/database'

export const ABUSE_TYPE_LABELS: Record<AbuseType, string> = {
  abandonment: 'Abandon',
  neglect: 'Négligence',
  physical_violence: 'Violence physique',
  inadequate_conditions: 'Conditions inadaptées',
  psychological: 'Maltraitance psychologique',
  illegal_breeding: 'Élevage illégal',
  other: 'Autre',
}

export const SEVERITY_LABELS: Record<AbuseSeverity, string> = {
  urgent: 'Urgent (vie en danger)',
  serious: 'Grave',
  recurring: 'Récurrent',
  suspicion: 'Suspicion',
}

export const STATUS_LABELS: Record<AbuseReportStatus, string> = {
  new: 'Nouveau',
  investigating: 'En cours',
  transmitted_authorities: 'Transmis autorités',
  on_site_intervention: 'Intervention sur place',
  resolved: 'Résolu',
  unfounded: 'Non-fondé',
  archived: 'Archivé',
}

export const ANIMAL_TYPE_LABELS: Record<AnimalType, string> = {
  dog: 'Chien',
  cat: 'Chat',
  farm: 'Animal de ferme',
  wildlife: 'Faune sauvage',
  other: 'Autre',
}
