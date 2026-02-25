/**
 * Hunimalis API Client
 * Handles authentication (JWT) and animal data fetching from hunimalis.com
 */

import type { AnimalStatus } from '@/lib/types/database'

const HUNIMALIS_API_URL = process.env.HUNIMALIS_API_URL || 'https://www.hunimalis.com/api'
const HUNIMALIS_USERNAME = process.env.HUNIMALIS_USERNAME || ''
const HUNIMALIS_PASSWORD = process.env.HUNIMALIS_PASSWORD || ''

// Token cache (server-side, in-memory)
let cachedToken: string | null = null
let tokenExpiresAt: number = 0

// ============================================
// Location → Status mapping
// ============================================

const HUNIMALIS_LOCATIONS: { id: number; label: string; status: AnimalStatus }[] = [
  { id: 1, label: 'Refuge', status: 'shelter' },
  { id: 2, label: 'Fourriere', status: 'pound' },
  { id: 3, label: 'Pension', status: 'boarding' },
  { id: 5, label: 'Famille d\'accueil', status: 'foster_family' },
]

// ============================================
// Types for Hunimalis API responses
// ============================================

export interface HunimalisAnimal {
  id: number
  name: string
  secondName: string[]
  medal: string | null
  specie: { name: string } | null
  race: { name: string } | null
  racecrossing: string
  gender: number | null
  genderoperated: number | null
  birthday: string | null
  birthwhere: string | null
  colormain: { name: string } | null
  colorsecondary: { name: string } | null
  animalInformation: { chip: string } | null
  tattoo: string
  tattooposition: string | null
  passport: string | null
  lof: string | null
  description: string | null
  story: string | null
  shelterDate: string | null
  picture: string | null
  booked: boolean
  declawed: boolean | null
  fears: string | null
  cleanliness: string | null
  healthInformation: string | null
  food: string | null
  scribblerbiter: string | null
}

// Extended with location info after fetching
export interface HunimalisAnimalWithLocation extends HunimalisAnimal {
  _locationId: number
  _locationLabel: string
  _status: AnimalStatus
}

interface HunimalisAnimalsResponse {
  page: number
  location: number
  offset: number
  limit: number
  total: number
  animals: HunimalisAnimal[]
}

// ============================================
// Authentication
// ============================================

async function getToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken
  }

  const res = await fetch(`${HUNIMALIS_API_URL}/login_check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: HUNIMALIS_USERNAME,
      password: HUNIMALIS_PASSWORD,
    }),
  })

  if (!res.ok) {
    throw new Error(`Hunimalis login failed: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  cachedToken = data.token

  // JWT tokens from Hunimalis expire in 1 hour (3600s)
  // Parse the exp from the token payload
  try {
    const payload = JSON.parse(atob(data.token.split('.')[1]))
    tokenExpiresAt = payload.exp * 1000
  } catch {
    // Fallback: assume 50 minutes validity
    tokenExpiresAt = Date.now() + 50 * 60 * 1000
  }

  return data.token
}

// ============================================
// API calls
// ============================================

async function fetchAnimalsForLocation(
  token: string,
  locationId: number,
  locationLabel: string,
  status: AnimalStatus,
): Promise<HunimalisAnimalWithLocation[]> {
  const allAnimals: HunimalisAnimalWithLocation[] = []
  let page = 1
  const limit = 200

  while (true) {
    const url = `${HUNIMALIS_API_URL}/animals?page=${page}&location=${locationId}&limit=${limit}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      throw new Error(`Hunimalis fetch animals (location=${locationId}) failed: ${res.status} ${res.statusText}`)
    }

    const data: HunimalisAnimalsResponse = await res.json()
    const tagged = data.animals.map((a) => ({
      ...a,
      _locationId: locationId,
      _locationLabel: locationLabel,
      _status: status,
    }))
    allAnimals.push(...tagged)

    if (data.animals.length < limit || allAnimals.length >= data.total) {
      break
    }

    page++
  }

  return allAnimals
}

export async function fetchAllAnimals(): Promise<{
  animals: HunimalisAnimalWithLocation[]
  total: number
  byLocation: { id: number; label: string; count: number }[]
}> {
  const token = await getToken()

  // Fetch all locations in parallel
  const results = await Promise.all(
    HUNIMALIS_LOCATIONS.map((loc) =>
      fetchAnimalsForLocation(token, loc.id, loc.label, loc.status)
    )
  )

  const allAnimals = results.flat()
  const byLocation = HUNIMALIS_LOCATIONS.map((loc, i) => ({
    id: loc.id,
    label: loc.label,
    count: results[i].length,
  }))

  return { animals: allAnimals, total: allAnimals.length, byLocation }
}

// ============================================
// Data mapping: Hunimalis → Optimus Animal
// ============================================

export function mapHunimalisToAnimal(h: HunimalisAnimalWithLocation): {
  hunimalis_id: number
  name: string
  name_secondary: string | null
  species: 'cat' | 'dog'
  breed: string | null
  breed_cross: string | null
  sex: 'male' | 'female' | 'unknown'
  birth_date: string | null
  birth_place: string | null
  color: string | null
  sterilized: boolean
  chip_number: string | null
  tattoo_number: string | null
  tattoo_position: string | null
  medal_number: string | null
  loof_number: string | null
  passport_number: string | null
  description: string | null
  status: AnimalStatus
  origin_type: 'found'
  pound_entry_date: string | null
  shelter_entry_date: string | null
  icad_updated: boolean
} {
  // Species mapping
  const specieRaw = h.specie?.name?.toLowerCase() || ''
  const species: 'cat' | 'dog' = specieRaw.includes('chat') ? 'cat' : 'dog'

  // Gender mapping (1 = male, 2 = female in Hunimalis)
  let sex: 'male' | 'female' | 'unknown' = 'unknown'
  if (h.gender === 1) sex = 'male'
  else if (h.gender === 2) sex = 'female'

  // Birth date (ISO string → date only)
  let birthDate: string | null = null
  if (h.birthday) {
    birthDate = h.birthday.split('T')[0]
  }

  // Entry date
  let entryDate: string | null = null
  if (h.shelterDate) {
    entryDate = h.shelterDate.replace(' ', 'T') + (h.shelterDate.includes('+') ? '' : '+00:00')
  }

  // Build description from description + story + location
  const parts: string[] = []
  if (h.description) parts.push(h.description)
  if (h.story) parts.push(h.story)
  // Add location label for non-refuge animals
  if (h._locationId !== 1) {
    parts.push(`[Hunimalis: ${h._locationLabel}]`)
  }
  const description = parts.length > 0 ? parts.join('\n\n') : null

  return {
    hunimalis_id: h.id,
    name: h.name || 'Sans nom',
    name_secondary: h.secondName?.length > 0 ? h.secondName.join(', ') : null,
    species,
    breed: h.race?.name || null,
    breed_cross: h.racecrossing || null,
    sex,
    birth_date: birthDate,
    birth_place: h.birthwhere || null,
    color: h.colormain?.name || null,
    sterilized: h.genderoperated === 1,
    chip_number: h.animalInformation?.chip || null,
    tattoo_number: h.tattoo || null,
    tattoo_position: h.tattooposition || null,
    medal_number: h.medal || null,
    loof_number: h.lof || null,
    passport_number: h.passport || null,
    description,
    status: h._status,
    origin_type: 'found',
    pound_entry_date: h._status === 'pound' ? entryDate : null,
    shelter_entry_date: h._status === 'shelter' ? entryDate : null,
    icad_updated: false,
  }
}
