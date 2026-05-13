import type { AnimalSpecies } from './types/database'

export const SPECIES_LABELS: Record<AnimalSpecies, string> = {
  dog: 'Chien',
  cat: 'Chat',
  rabbit: 'Lapin',
  guinea_pig: "Cochon d'Inde",
  hamster: 'Hamster',
  rat: 'Rat',
  ferret: 'Furet',
  chinchilla: 'Chinchilla',
  goat: 'Chèvre',
  sheep: 'Mouton',
  pig: 'Cochon',
  cow: 'Vache',
  horse: 'Cheval',
  donkey: 'Âne',
  pony: 'Poney',
  chicken: 'Poule',
  duck: 'Canard',
  goose: 'Oie',
  parakeet: 'Perruche',
  parrot: 'Perroquet',
  canary: 'Canari',
  tortoise: 'Tortue',
  other: 'Autre',
}

export const SPECIES_LABELS_PLURAL: Record<AnimalSpecies, string> = {
  dog: 'Chiens',
  cat: 'Chats',
  rabbit: 'Lapins',
  guinea_pig: "Cochons d'Inde",
  hamster: 'Hamsters',
  rat: 'Rats',
  ferret: 'Furets',
  chinchilla: 'Chinchillas',
  goat: 'Chèvres',
  sheep: 'Moutons',
  pig: 'Cochons',
  cow: 'Vaches',
  horse: 'Chevaux',
  donkey: 'Ânes',
  pony: 'Poneys',
  chicken: 'Poules',
  duck: 'Canards',
  goose: 'Oies',
  parakeet: 'Perruches',
  parrot: 'Perroquets',
  canary: 'Canaris',
  tortoise: 'Tortues',
  other: 'Autres',
}

export const SPECIES_EMOJIS: Record<AnimalSpecies, string> = {
  dog: '🐶',
  cat: '🐱',
  rabbit: '🐰',
  guinea_pig: '🐹',
  hamster: '🐹',
  rat: '🐀',
  ferret: '🦦',
  chinchilla: '🐭',
  goat: '🐐',
  sheep: '🐑',
  pig: '🐷',
  cow: '🐮',
  horse: '🐴',
  donkey: '🫏',
  pony: '🐎',
  chicken: '🐔',
  duck: '🦆',
  goose: '🪿',
  parakeet: '🦜',
  parrot: '🦜',
  canary: '🐦',
  tortoise: '🐢',
  other: '🐾',
}

export function getSpeciesLabel(species: AnimalSpecies | string | null | undefined): string {
  if (!species) return 'Inconnu'
  return SPECIES_LABELS[species as AnimalSpecies] ?? species
}

export function getSpeciesLabelPlural(species: AnimalSpecies | string | null | undefined): string {
  if (!species) return 'Inconnus'
  return SPECIES_LABELS_PLURAL[species as AnimalSpecies] ?? species
}

export function getSpeciesEmoji(species: AnimalSpecies | string | null | undefined): string {
  if (!species) return '🐾'
  return SPECIES_EMOJIS[species as AnimalSpecies] ?? '🐾'
}

// ---- Catégories d'espèces ----

export const EQUIDS: AnimalSpecies[] = ['horse', 'donkey', 'pony']
export const FARM_RUMINANTS_PORCINES: AnimalSpecies[] = ['goat', 'sheep', 'pig', 'cow']
export const POULTRY: AnimalSpecies[] = ['chicken', 'duck', 'goose']
export const BIRDS: AnimalSpecies[] = ['parakeet', 'parrot', 'canary']
export const SMALL_MAMMALS: AnimalSpecies[] = [
  'rabbit', 'guinea_pig', 'hamster', 'rat', 'ferret', 'chinchilla',
]
export const REPTILES: AnimalSpecies[] = ['tortoise']

export function isEquid(species: AnimalSpecies | null | undefined): boolean {
  return !!species && EQUIDS.includes(species as AnimalSpecies)
}

export function isFarmRuminantOrPorcine(species: AnimalSpecies | null | undefined): boolean {
  return !!species && FARM_RUMINANTS_PORCINES.includes(species as AnimalSpecies)
}

export function isPoultry(species: AnimalSpecies | null | undefined): boolean {
  return !!species && POULTRY.includes(species as AnimalSpecies)
}

export function isBird(species: AnimalSpecies | null | undefined): boolean {
  return !!species && (BIRDS.includes(species as AnimalSpecies) || POULTRY.includes(species as AnimalSpecies))
}

export function isSmallMammal(species: AnimalSpecies | null | undefined): boolean {
  return !!species && SMALL_MAMMALS.includes(species as AnimalSpecies)
}

// ---- Champs d'identification disponibles selon l'espèce ----

export type IdField =
  | 'chip_number'
  | 'tattoo'
  | 'medal_number'
  | 'loof_number'
  | 'passport_number'
  | 'sire_number'
  | 'ede_number'
  | 'ring_number'

/**
 * Renvoie les champs d'identification pertinents pour une espèce.
 * - Chien/Chat : puce, tatouage, médaille, passeport (+ LOOF pour le chat)
 * - Équidés    : transpondeur (puce), passeport SIRE, n° SIRE
 * - Bovins/Ovins/Caprins/Porcins : n° EDE, n° boucle (champ médaille réutilisé)
 * - Oiseaux    : n° de bague
 * - NAC        : puce (si pucé), médaille
 */
export function getIdentificationFieldsForSpecies(species: AnimalSpecies | null | undefined): IdField[] {
  if (!species) return ['chip_number', 'tattoo', 'medal_number']

  if (species === 'dog') {
    return ['chip_number', 'tattoo', 'medal_number', 'passport_number']
  }
  if (species === 'cat') {
    return ['chip_number', 'tattoo', 'medal_number', 'loof_number', 'passport_number']
  }
  if (isEquid(species)) {
    return ['chip_number', 'passport_number', 'sire_number']
  }
  if (isFarmRuminantOrPorcine(species)) {
    return ['ede_number', 'medal_number', 'chip_number']
  }
  if (isBird(species)) {
    return ['ring_number', 'chip_number']
  }
  if (isSmallMammal(species)) {
    return ['chip_number', 'medal_number', 'tattoo']
  }
  if (species === 'tortoise') {
    return ['chip_number', 'medal_number']
  }
  // other / fallback
  return ['chip_number', 'tattoo', 'medal_number']
}

/**
 * Label du champ "Puce" qui s'adapte à l'espèce (transpondeur pour équidés, n° de puce sinon).
 */
export function getChipLabel(species: AnimalSpecies | null | undefined): string {
  if (isEquid(species)) return 'N° transpondeur'
  return 'N° de puce'
}

/**
 * Label du champ "Passeport" qui s'adapte (passeport SIRE pour équidés, passeport européen sinon).
 */
export function getPassportLabel(species: AnimalSpecies | null | undefined): string {
  if (isEquid(species)) return 'N° passeport SIRE'
  return 'N° passeport européen'
}

/**
 * Label du champ "Médaille" qui s'adapte (n° boucle pour bovins/ovins/caprins/porcins).
 */
export function getMedalLabel(species: AnimalSpecies | null | undefined): string {
  if (isFarmRuminantOrPorcine(species)) return "N° boucle d'oreille"
  return 'N° de médaille'
}

/**
 * L'espèce a-t-elle un système de compatibilité (ok_cats / ok_males / ok_females) ?
 * → uniquement les chiens pour l'instant.
 */
export function supportsCompatibility(species: AnimalSpecies | null | undefined): boolean {
  return species === 'dog'
}

/**
 * L'espèce relève-t-elle de l'I-CAD (chiens et chats uniquement, en droit français) ?
 */
export function isIcadEligible(species: AnimalSpecies | null | undefined): boolean {
  return species === 'dog' || species === 'cat'
}

/**
 * Toutes les espèces, sous forme de liste ordonnée pour les dropdowns.
 * Ordre : chien/chat d'abord (les plus fréquents), puis NAC, puis ferme, puis équidés, puis oiseaux, puis autres.
 */
export const ALL_SPECIES: AnimalSpecies[] = [
  'dog', 'cat',
  'rabbit', 'guinea_pig', 'hamster', 'rat', 'ferret', 'chinchilla',
  'goat', 'sheep', 'pig', 'cow',
  'horse', 'donkey', 'pony',
  'chicken', 'duck', 'goose',
  'parakeet', 'parrot', 'canary',
  'tortoise',
  'other',
]
