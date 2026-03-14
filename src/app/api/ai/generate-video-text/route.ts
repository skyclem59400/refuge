import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

// ── Types ──

interface VideoTextRequest {
  postType: string
  animalName?: string
  animalSpecies?: string
  content: string
  establishmentName: string
  hint?: string
}

// ── Constants ──

const POST_TYPE_LABELS: Record<string, string> = {
  adoption: 'adoption',
  search_owner: 'recherche de proprietaire',
  event: 'evenement',
  info: 'information',
  other: 'publication generale',
}

// ── Helpers ──

function formatSpeciesLabel(species?: string): string {
  if (species === 'dog') return 'chien'
  if (species === 'cat') return 'chat'
  return species || ''
}

function buildVideoTextPrompt(body: VideoTextRequest): string {
  const typeLabel = POST_TYPE_LABELS[body.postType] || 'publication'
  const animalLine = body.animalName
    ? `- Animal : ${body.animalName}${body.animalSpecies ? ` (${formatSpeciesLabel(body.animalSpecies)})` : ''}`
    : ''

  let prompt = `Tu es un redacteur pour ${body.establishmentName}, un refuge animalier.
Genere une SEULE phrase courte et percutante pour une video de reseau social (Instagram/Facebook).

Contexte :
- Type de publication : ${typeLabel}
${animalLine ? `${animalLine}\n` : ''}- Texte original du post : "${body.content.slice(0, 500)}"

Contraintes STRICTES :
- Maximum 80 caracteres (espaces inclus)
- UNE seule phrase, pas de saut de ligne
- Ton emotionnel et engageant
- Pas de hashtags, pas d'emojis
- Pas de guillemets autour de la phrase
- La phrase doit donner envie de regarder la video`

  if (body.hint) {
    prompt += `\n\nIndication supplementaire de l'utilisateur : "${body.hint}"`
  }

  return prompt
}

function extractVideoText(message: Anthropic.Message): string {
  return message.content[0].type === 'text'
    ? message.content[0].text.trim().replace(/(?:^["'])|(?:["']$)/g, '')
    : ''
}

// ── Error Handling ──

function handleVideoTextError(error: unknown): Response {
  console.error('AI video text generation error:', error)
  const errMsg = error instanceof Error ? error.message : String(error)

  if (errMsg.includes('credit balance') || errMsg.includes('billing')) {
    return Response.json(
      { error: 'Solde API Anthropic insuffisant' },
      { status: 402 }
    )
  }

  return Response.json(
    { error: 'Erreur lors de la generation du texte video' },
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
      return Response.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await request.json() as VideoTextRequest
    const prompt = buildVideoTextPrompt(body)

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    })

    const videoText = extractVideoText(message)
    return Response.json({ videoText })
  } catch (error: unknown) {
    return handleVideoTextError(error)
  }
}
