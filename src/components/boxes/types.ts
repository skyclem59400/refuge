import type { Box } from '@/lib/types/database'

export interface BoxAnimal {
  id: string
  name: string
  species: string
  sex?: string | null
  status?: string | null
  photo_url?: string | null
  birth_date?: string | null
  sterilized?: boolean | null
  adoptable?: boolean | null
  reserved?: boolean | null
}

export type EnrichedBox = Box & {
  animals: BoxAnimal[]
  animal_count: number
  zone?: {
    id: string
    name: string
    parent_id: string | null
    parent?: { id: string; name: string } | null
  } | null
  zone_id?: string | null
}

// Resume de box pour le picker "Deplacer vers"
export interface BoxSummary {
  id: string
  name: string
  capacity: number
  species_type: string
  zone_label?: string | null
  current_count: number
}
