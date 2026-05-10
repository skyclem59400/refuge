// Palette deterministe pour la sectorisation des box.
// Chaque zone racine recoit une couleur stable derivee de son UUID.
// Les sous-zones heritent de la couleur du parent en variante pale.

export interface ZoneColor {
  name: string
  // Classes Tailwind pretes a l'emploi
  bg: string         // Fond plein moyen (header zone)
  bgSoft: string     // Fond doux (carte zone)
  bgSofter: string   // Fond tres doux (sous-zone)
  border: string     // Bordure (4px gauche carte zone)
  borderSoft: string // Bordure douce (sous-zone)
  text: string       // Texte sur fond clair
  textOn: string     // Texte sur fond plein
  dot: string        // Pastille couleur
  ring: string       // Ring focus / hover
}

// 8 teintes : bleu marine + teal + orange terracotta (charte SDA) + 5 complementaires
const PALETTE: ZoneColor[] = [
  {
    name: 'navy',
    bg: 'bg-blue-900',
    bgSoft: 'bg-blue-50 dark:bg-blue-950/30',
    bgSofter: 'bg-blue-50/50 dark:bg-blue-950/15',
    border: 'border-blue-700 dark:border-blue-500',
    borderSoft: 'border-blue-300 dark:border-blue-800',
    text: 'text-blue-900 dark:text-blue-200',
    textOn: 'text-white',
    dot: 'bg-blue-700',
    ring: 'ring-blue-500/30',
  },
  {
    name: 'teal',
    bg: 'bg-teal-700',
    bgSoft: 'bg-teal-50 dark:bg-teal-950/30',
    bgSofter: 'bg-teal-50/50 dark:bg-teal-950/15',
    border: 'border-teal-600 dark:border-teal-400',
    borderSoft: 'border-teal-300 dark:border-teal-800',
    text: 'text-teal-800 dark:text-teal-200',
    textOn: 'text-white',
    dot: 'bg-teal-600',
    ring: 'ring-teal-500/30',
  },
  {
    name: 'terracotta',
    bg: 'bg-orange-700',
    bgSoft: 'bg-orange-50 dark:bg-orange-950/30',
    bgSofter: 'bg-orange-50/50 dark:bg-orange-950/15',
    border: 'border-orange-600 dark:border-orange-400',
    borderSoft: 'border-orange-300 dark:border-orange-800',
    text: 'text-orange-800 dark:text-orange-200',
    textOn: 'text-white',
    dot: 'bg-orange-600',
    ring: 'ring-orange-500/30',
  },
  {
    name: 'emerald',
    bg: 'bg-emerald-700',
    bgSoft: 'bg-emerald-50 dark:bg-emerald-950/30',
    bgSofter: 'bg-emerald-50/50 dark:bg-emerald-950/15',
    border: 'border-emerald-600 dark:border-emerald-400',
    borderSoft: 'border-emerald-300 dark:border-emerald-800',
    text: 'text-emerald-800 dark:text-emerald-200',
    textOn: 'text-white',
    dot: 'bg-emerald-600',
    ring: 'ring-emerald-500/30',
  },
  {
    name: 'violet',
    bg: 'bg-violet-700',
    bgSoft: 'bg-violet-50 dark:bg-violet-950/30',
    bgSofter: 'bg-violet-50/50 dark:bg-violet-950/15',
    border: 'border-violet-600 dark:border-violet-400',
    borderSoft: 'border-violet-300 dark:border-violet-800',
    text: 'text-violet-800 dark:text-violet-200',
    textOn: 'text-white',
    dot: 'bg-violet-600',
    ring: 'ring-violet-500/30',
  },
  {
    name: 'amber',
    bg: 'bg-amber-600',
    bgSoft: 'bg-amber-50 dark:bg-amber-950/30',
    bgSofter: 'bg-amber-50/50 dark:bg-amber-950/15',
    border: 'border-amber-500 dark:border-amber-400',
    borderSoft: 'border-amber-300 dark:border-amber-800',
    text: 'text-amber-800 dark:text-amber-200',
    textOn: 'text-white',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/30',
  },
  {
    name: 'rose',
    bg: 'bg-rose-700',
    bgSoft: 'bg-rose-50 dark:bg-rose-950/30',
    bgSofter: 'bg-rose-50/50 dark:bg-rose-950/15',
    border: 'border-rose-600 dark:border-rose-400',
    borderSoft: 'border-rose-300 dark:border-rose-800',
    text: 'text-rose-800 dark:text-rose-200',
    textOn: 'text-white',
    dot: 'bg-rose-600',
    ring: 'ring-rose-500/30',
  },
  {
    name: 'indigo',
    bg: 'bg-indigo-700',
    bgSoft: 'bg-indigo-50 dark:bg-indigo-950/30',
    bgSofter: 'bg-indigo-50/50 dark:bg-indigo-950/15',
    border: 'border-indigo-600 dark:border-indigo-400',
    borderSoft: 'border-indigo-300 dark:border-indigo-800',
    text: 'text-indigo-800 dark:text-indigo-200',
    textOn: 'text-white',
    dot: 'bg-indigo-600',
    ring: 'ring-indigo-500/30',
  },
]

export const NONE_ZONE_COLOR: ZoneColor = {
  name: 'neutral',
  bg: 'bg-zinc-600',
  bgSoft: 'bg-zinc-50 dark:bg-zinc-900/40',
  bgSofter: 'bg-zinc-50/40 dark:bg-zinc-900/20',
  border: 'border-zinc-400 dark:border-zinc-600',
  borderSoft: 'border-zinc-300 dark:border-zinc-700',
  text: 'text-zinc-700 dark:text-zinc-300',
  textOn: 'text-white',
  dot: 'bg-zinc-500',
  ring: 'ring-zinc-500/30',
}

// Hash deterministe simple sur un UUID -> index dans la palette.
// Pas besoin de cryptographie, juste une distribution stable.
function hashToIndex(uuid: string, modulo: number): number {
  let h = 0
  for (let i = 0; i < uuid.length; i++) {
    h = (h * 31 + uuid.charCodeAt(i)) | 0
  }
  return Math.abs(h) % modulo
}

export function getZoneColor(rootZoneId: string | null | undefined): ZoneColor {
  if (!rootZoneId) return NONE_ZONE_COLOR
  return PALETTE[hashToIndex(rootZoneId, PALETTE.length)]
}
