import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getSpeciesLabel, getSexLabel, calculateAge } from '@/lib/sda-utils'

// ── Types ──

interface GeneratePostRequest {
  animalId: string
  postType: 'search_owner' | 'adoption'
  platform: 'facebook' | 'instagram' | 'both'
  additionalNotes?: string
}

interface AnimalData {
  name: string
  species: string
  breed: string | null
  sex: string
  color: string | null
  chip_number: string | null
  tattoo_number: string | null
  birth_date: string | null
  pound_entry_date: string | null
  capture_location: string | null
  capture_circumstances: string | null
  description: string | null
  sterilized: boolean
  behavior_score: number | null
  animal_photos: { url: string; is_primary: boolean }[]
}

// ── Constants ──

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  both: 'Facebook et Instagram',
}

const PLATFORM_INSTRUCTIONS: Record<string, string> = {
  facebook:
    'Format adapte a Facebook : paragraphes aeres, longueur moyenne (150-250 mots)',
  instagram:
    'Format adapte a Instagram : texte plus court (100-150 mots), terminer par quelques hashtags pertinents (#adoption #refuge #SDAEstormel)',
  both:
    'Format adapte a Facebook et Instagram : texte polyvalent (150-200 mots), terminer par quelques hashtags',
}

// ── Helpers ──

function getIdentificationInfo(animal: AnimalData): string {
  if (animal.chip_number) return `Puce ${animal.chip_number}`
  if (animal.tattoo_number) return `Tatouage ${animal.tattoo_number}`
  return 'Non identifie'
}

function formatEntryDate(date: string | null): string {
  if (!date) return 'Non precisee'
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function buildSearchOwnerPrompt(
  animal: AnimalData,
  platformLabel: string,
  platform: string,
  additionalNotes?: string
): string {
  const speciesLabel = getSpeciesLabel(animal.species)
  const sexLabel = getSexLabel(animal.sex)
  const chipInfo = getIdentificationInfo(animal)
  const formattedDate = formatEntryDate(animal.pound_entry_date)

  return `Tu es un redacteur pour la SDA Estormel, refuge animalier dans le Nord de la France.
Redige un post ${platformLabel} pour rechercher le proprietaire d'un animal trouve.

Informations sur l'animal :
- Nom provisoire : ${animal.name}
- Espece : ${speciesLabel}
- Race : ${animal.breed || 'Inconnue'}
- Sexe : ${sexLabel}
- Couleur/pelage : ${animal.color || 'Non precise'}
- Identification : ${chipInfo}
- Lieu de capture : ${animal.capture_location || 'Non precise'}
- Circonstances : ${animal.capture_circumstances || 'Non precisees'}
- Date d'entree : ${formattedDate}
${additionalNotes ? `\nNotes de l'equipe : ${additionalNotes}` : ''}

Consignes :
- Ton bienveillant et professionnel
- Inclure une description physique precise
- Mentionner le lieu de capture
- Inviter a contacter le refuge (SDA Estormel)
- Rappeler l'importance de l'identification
- Utiliser des emojis avec parcimonie (2-3 max)
- ${PLATFORM_INSTRUCTIONS[platform]}
- Ne pas mettre de hashtags en plein milieu du texte
- IMPORTANT : texte brut uniquement, AUCUN formatage markdown (pas de **, pas de #, pas de _, pas de titres). Juste du texte lisible directement.`
}

function buildAdoptionPrompt(
  animal: AnimalData,
  platformLabel: string,
  platform: string,
  additionalNotes?: string
): string {
  const speciesLabel = getSpeciesLabel(animal.species)
  const sexLabel = getSexLabel(animal.sex)
  const ageStr = calculateAge(animal.birth_date)

  return `Tu es un redacteur pour la SDA Estormel, refuge animalier dans le Nord de la France.
Redige un post ${platformLabel} pour promouvoir l'adoption d'un animal.

Informations sur l'animal :
- Prenom : ${animal.name}
- Espece : ${speciesLabel}
- Race : ${animal.breed || 'Croise'}
- Sexe : ${sexLabel}
- Age : ${ageStr}
- Couleur/pelage : ${animal.color || 'Non precise'}
- Sterilise : ${animal.sterilized ? 'Oui' : 'Non'}
- Caractere : ${animal.description || 'A decouvrir au refuge'}
- Score comportement : ${animal.behavior_score ? `${animal.behavior_score}/5` : 'Non evalue'}
${additionalNotes ? `\nNotes de l'equipe : ${additionalNotes}` : ''}

Consignes :
- Ton chaleureux et engageant
- Mettre en valeur le caractere de l'animal
- Donner envie de venir le rencontrer
- Mentionner les conditions d'adoption (visite prealable, entretien)
- Inviter a contacter la SDA Estormel
- Utiliser des emojis avec parcimonie (2-3 max)
- ${PLATFORM_INSTRUCTIONS[platform]}
- Terminer par un appel a l'action
- IMPORTANT : texte brut uniquement, AUCUN formatage markdown (pas de **, pas de #, pas de _, pas de titres). Juste du texte lisible directement.`
}

function buildPrompt(
  animal: AnimalData,
  postType: string,
  platform: string,
  additionalNotes?: string
): string {
  const platformLabel = PLATFORM_LABELS[platform]

  if (postType === 'search_owner') {
    return buildSearchOwnerPrompt(animal, platformLabel, platform, additionalNotes)
  }
  return buildAdoptionPrompt(animal, platformLabel, platform, additionalNotes)
}

function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')     // Remove # headings
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove **bold**
    .replace(/__(.*?)__/g, '$1')      // Remove __bold__
    .replace(/\*(.*?)\*/g, '$1')      // Remove *italic*
    .replace(/_(.*?)_/g, '$1')        // Remove _italic_
    .trim()
}

// ── Error Handling ──

function handleAnthropicError(error: unknown): Response {
  console.error('AI generation error:', error)
  const errMsg = error instanceof Error ? error.message : String(error)

  if (errMsg.includes('credit balance') || errMsg.includes('billing')) {
    return Response.json(
      { error: 'Solde API Anthropic insuffisant. Ajoutez des credits sur console.anthropic.com/settings/plans' },
      { status: 402 }
    )
  }

  if (errMsg.includes('invalid x-api-key') || errMsg.includes('authentication')) {
    return Response.json(
      { error: 'Cle API Anthropic invalide. Verifiez ANTHROPIC_API_KEY dans vos variables d\'environnement.' },
      { status: 401 }
    )
  }

  if (errMsg.includes('rate limit') || errMsg.includes('429')) {
    return Response.json(
      { error: 'Limite de requetes atteinte. Reessayez dans quelques instants.' },
      { status: 429 }
    )
  }

  return Response.json(
    { error: 'Erreur lors de la generation du texte. Reessayez.' },
    { status: 500 }
  )
}

// ── Route Handler ──

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: 'Configuration IA manquante' },
        { status: 500 }
      )
    }

    // Verify authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json(
        { error: 'Non autorise' },
        { status: 401 }
      )
    }

    const { animalId, postType, platform, additionalNotes } = await request.json() as GeneratePostRequest

    // Fetch animal data with photos
    const admin = createAdminClient()
    const { data: animal, error: animalError } = await admin
      .from('animals')
      .select('*, animal_photos(url, is_primary)')
      .eq('id', animalId)
      .single()

    if (animalError || !animal) {
      return Response.json(
        { error: 'Animal non trouve' },
        { status: 404 }
      )
    }

    const prompt = buildPrompt(animal, postType, platform, additionalNotes)

    // Call Claude API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText =
      message.content[0].type === 'text' ? message.content[0].text : ''

    const generatedText = stripMarkdownFormatting(rawText)

    return Response.json({ content: generatedText })
  } catch (error: unknown) {
    return handleAnthropicError(error)
  }
}
