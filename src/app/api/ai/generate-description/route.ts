import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getSpeciesLabel, getSexLabel, calculateAge } from '@/lib/sda-utils'

function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .trim()
}

function formatCompatibility(val: boolean | null): string {
  if (val === true) return 'Oui'
  if (val === false) return 'Non'
  return 'Non evalue'
}

function buildPrompt(animal: {
  name: string
  species: string
  breed: string | null
  breed_cross: string | null
  sex: string
  birth_date: string | null
  color: string | null
  weight: number | null
  sterilized: boolean
  behavior_score: number | null
  description: string | null
  ok_cats: boolean | null
  ok_males: boolean | null
  ok_females: boolean | null
}): string {
  const lines: string[] = []
  lines.push(`- Nom : ${animal.name}`)
  lines.push(`- Espece : ${getSpeciesLabel(animal.species)}`)
  if (animal.breed) {
    lines.push(`- Race : ${animal.breed}${animal.breed_cross ? ` x ${animal.breed_cross}` : ''}`)
  }
  lines.push(`- Sexe : ${getSexLabel(animal.sex)}`)
  lines.push(`- Age : ${calculateAge(animal.birth_date)}`)
  if (animal.color) lines.push(`- Couleur : ${animal.color}`)
  if (animal.weight) lines.push(`- Poids : ${animal.weight} kg`)
  lines.push(`- Sterilise(e) : ${animal.sterilized ? 'Oui' : 'Non'}`)

  if (animal.species === 'dog') {
    lines.push(`- OK chats : ${formatCompatibility(animal.ok_cats)}`)
    lines.push(`- OK males : ${formatCompatibility(animal.ok_males)}`)
    lines.push(`- OK femelles : ${formatCompatibility(animal.ok_females)}`)
  }

  if (animal.behavior_score != null) {
    const labels: Record<number, string> = { 1: 'Tres sociable', 2: 'Sociable', 3: 'Reserve', 4: 'Craintif', 5: 'Agressif' }
    lines.push(`- Comportement : ${labels[animal.behavior_score] || animal.behavior_score + '/5'}`)
  }

  if (animal.description) {
    lines.push(`- Notes internes : ${animal.description}`)
  }

  return `Tu es un redacteur pour la SDA Estormel, un refuge animalier dans le Nord de la France. A partir des informations suivantes sur un animal, redige une description chaleureuse et engageante destinee au public (site web, reseaux sociaux, fiche d'adoption).

Informations :
${lines.join('\n')}

Consignes :
- 150-250 mots
- Ton chaleureux, bienveillant et engageant
- Mettre en valeur les qualites et la personnalite de l'animal
- Ne PAS mentionner d'informations medicales sensibles ou de notes internes negatives
- Ne PAS utiliser de formatage markdown (pas de **, #, _, etc.)
- Terminer par un appel a l'action invitant a venir rencontrer l'animal au refuge
- Texte brut uniquement, pas de titre`
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: 'Configuration IA manquante' }, { status: 500 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Non autorise' }, { status: 401 })
    }

    const { animalId } = await request.json() as { animalId: string }

    const admin = createAdminClient()
    const { data: animal, error: animalError } = await admin
      .from('animals')
      .select('*')
      .eq('id', animalId)
      .single()

    if (animalError || !animal) {
      return Response.json({ error: 'Animal non trouve' }, { status: 404 })
    }

    const prompt = buildPrompt(animal)

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    const generatedText = stripMarkdownFormatting(rawText)

    return Response.json({ content: generatedText })
  } catch (error: unknown) {
    console.error('AI description generation error:', error)
    const errMsg = error instanceof Error ? error.message : String(error)

    if (errMsg.includes('credit balance') || errMsg.includes('billing')) {
      return Response.json({ error: 'Solde API Anthropic insuffisant.' }, { status: 402 })
    }
    if (errMsg.includes('invalid x-api-key') || errMsg.includes('authentication')) {
      return Response.json({ error: 'Cle API Anthropic invalide.' }, { status: 401 })
    }
    if (errMsg.includes('rate limit') || errMsg.includes('429')) {
      return Response.json({ error: 'Limite de requetes atteinte. Reessayez.' }, { status: 429 })
    }

    return Response.json({ error: 'Erreur lors de la generation. Reessayez.' }, { status: 500 })
  }
}
