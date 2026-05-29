// Types pour les vues d'ensemble admin des parrainages.
// Extrait hors de sponsorships-admin.ts car Next.js 16 + Turbopack
// n'autorise que des async functions dans les fichiers 'use server'.

import type {
  Sponsorship,
  Animal,
  Client,
} from '@/lib/types/database'

export interface SponsorshipWithBoth extends Sponsorship {
  animal: Pick<Animal, 'id' | 'name' | 'species' | 'status' | 'photo_url'> | null
  client: Pick<Client, 'id' | 'kind' | 'name' | 'first_name' | 'email' | 'phone' | 'city'> | null
  total_donated?: number
}

export interface SponsorshipStats {
  /** Nombre de parrainages actifs (statut = active) */
  activeCount: number
  /** Nombre de parrains distincts ayant au moins un parrainage actif */
  distinctActiveSponsors: number
  /** Somme des monthly_amount des parrainages actifs */
  mrr: number
  /** Cumul des dons fléchés (donations.sponsorship_id NOT NULL) sur l'année courante */
  ytdRevenue: number
  /** Moyenne mensuelle par parrain actif */
  avgMonthlyPerSponsor: number
  /** Nombre total de versements liés à des parrainages (toutes années) */
  totalPayments: number
  /** Cumul total versé via parrainages (toutes années) */
  lifetimeRevenue: number
}
