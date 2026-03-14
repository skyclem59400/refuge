import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'

export const maxDuration = 60

// ── Types ──

interface TranscriptionAnalysis {
  summary: string | null
  sentiment: string | null
  actionItems: { text: string; completed: boolean }[]
}

interface CallRecord {
  id: string
  voicemail_url: string | null
  recording_url: string | null
  has_voicemail: boolean
  has_recording: boolean
  transcribed_at: string | null
}

// ── Validation ──

function validateApiKeys(): Response | null {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: 'Configuration OpenAI manquante (OPENAI_API_KEY)' },
      { status: 500 }
    )
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'Configuration Anthropic manquante (ANTHROPIC_API_KEY)' },
      { status: 500 }
    )
  }
  return null
}

function validateCallForTranscription(call: CallRecord): Response | null {
  if (call.transcribed_at) {
    return Response.json({ error: 'Cet appel a deja ete transcrit' }, { status: 409 })
  }

  const audioUrl = call.recording_url || call.voicemail_url
  if (!audioUrl) {
    return Response.json({ error: 'Aucun fichier audio disponible' }, { status: 400 })
  }

  return null
}

// ── Audio Download ──

async function downloadAudioFile(audioUrl: string): Promise<File | Response> {
  const audioResponse = await fetch(audioUrl)
  if (!audioResponse.ok) {
    return Response.json(
      { error: `Impossible de telecharger l'audio (${audioResponse.status})` },
      { status: 502 }
    )
  }

  const audioBuffer = await audioResponse.arrayBuffer()
  return new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' })
}

// ── Whisper Transcription ──

async function transcribeWithWhisper(audioFile: File): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const transcription = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file: audioFile,
    language: 'fr',
    response_format: 'text',
  })

  if (typeof transcription === 'string') return transcription
  return (transcription as unknown as { text: string }).text
}

// ── Claude Analysis ──

function extractJsonFromResponse(rawText: string): string {
  let text = rawText.trim()

  const fenceMatch = text.match(/^```\w*\s*\n?([\s\S]*?)\n?\s*```\s*$/)
  if (fenceMatch) text = fenceMatch[1].trim()

  if (!text.startsWith('{')) {
    const jsonMatch = text.match(/(\{[\s\S]*\})/)
    if (jsonMatch) text = jsonMatch[1]
  }

  return text
}

function parseAnalysisJson(aiText: string): TranscriptionAnalysis {
  try {
    const parsed = JSON.parse(aiText)
    const sentiment = ['positive', 'neutral', 'negative'].includes(parsed.sentiment)
      ? parsed.sentiment
      : null
    const actionItems = (parsed.action_items || []).map((item: string) => ({
      text: item,
      completed: false,
    }))
    return { summary: parsed.summary || null, sentiment, actionItems }
  } catch {
    return { summary: aiText.slice(0, 500), sentiment: null, actionItems: [] }
  }
}

async function analyzeWithClaude(transcript: string): Promise<TranscriptionAnalysis> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const aiResponse = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Analyse cette transcription d'un appel telephonique recu par un refuge animalier (SDA).

Transcription :
"""
${transcript}
"""

Reponds UNIQUEMENT en JSON valide avec cette structure exacte :
{
  "summary": "Resume en 1-2 phrases de l'objet de l'appel",
  "sentiment": "positive" | "neutral" | "negative",
  "action_items": ["action 1", "action 2"]
}

Regles :
- Le resume doit etre concis et utile pour le personnel du refuge
- Le sentiment reflete le ton general de l'appelant
- Les action_items sont les actions concretes a effectuer (rappeler, verifier dispo chien, etc.). Liste vide si aucune action.
- Reponds UNIQUEMENT avec le JSON, rien d'autre`,
    }],
  })

  const rawAiText = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : '{}'
  const aiText = extractJsonFromResponse(rawAiText)
  return parseAnalysisJson(aiText)
}

// ── Database ──

async function saveEmptyTranscription(admin: SupabaseClient, callId: string, userId: string): Promise<Response> {
  await admin
    .from('ringover_calls')
    .update({
      transcript: '(Aucune parole detectee)',
      transcribed_at: new Date().toISOString(),
      transcribed_by: userId,
    })
    .eq('id', callId)

  return Response.json({
    transcript: '(Aucune parole detectee)',
    summary: null,
    sentiment: null,
    actionItems: [],
  })
}

async function saveTranscription(
  admin: SupabaseClient,
  callId: string,
  userId: string,
  transcript: string,
  analysis: TranscriptionAnalysis
): Promise<Response | null> {
  const { error: updateError } = await admin
    .from('ringover_calls')
    .update({
      transcript,
      transcript_language: 'fr',
      ai_summary: analysis.summary,
      ai_sentiment: analysis.sentiment,
      ai_action_items: analysis.actionItems,
      transcribed_at: new Date().toISOString(),
      transcribed_by: userId,
    })
    .eq('id', callId)

  if (updateError) {
    return Response.json(
      { error: `Erreur de sauvegarde: ${updateError.message}` },
      { status: 500 }
    )
  }

  return null
}

// ── Error Handling ──

function handleTranscriptionError(error: unknown): Response {
  console.error('Transcription error:', error)
  const errMsg = error instanceof Error ? error.message : String(error)

  if (errMsg.includes('insufficient_quota') || errMsg.includes('billing')) {
    return Response.json(
      { error: 'Quota OpenAI insuffisant. Verifiez votre compte.' },
      { status: 402 }
    )
  }
  if (errMsg.includes('rate limit') || errMsg.includes('429')) {
    return Response.json(
      { error: 'Limite de requetes atteinte. Reessayez dans quelques instants.' },
      { status: 429 }
    )
  }

  return Response.json(
    { error: 'Erreur lors de la transcription. Reessayez.' },
    { status: 500 }
  )
}

// ── Route Handler ──

export async function POST(request: NextRequest) {
  try {
    const keyError = validateApiKeys()
    if (keyError) return keyError

    // Verify authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Non autorise' }, { status: 401 })
    }

    const { callId } = await request.json() as { callId: string }
    if (!callId) {
      return Response.json({ error: 'callId requis' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Fetch the call record
    const { data: call, error: callError } = await admin
      .from('ringover_calls')
      .select('id, voicemail_url, recording_url, has_voicemail, has_recording, transcribed_at')
      .eq('id', callId)
      .single()

    if (callError || !call) {
      return Response.json({ error: 'Appel introuvable' }, { status: 404 })
    }

    const validationError = validateCallForTranscription(call)
    if (validationError) return validationError

    // Step 1: Download the MP3
    const audioUrl = (call.recording_url || call.voicemail_url)!
    const audioResult = await downloadAudioFile(audioUrl)
    if (audioResult instanceof Response) return audioResult

    // Step 2: Transcribe with Whisper
    const transcript = await transcribeWithWhisper(audioResult)

    // Treat very short transcripts as silence
    if (!transcript || transcript.trim().length < 5) {
      return saveEmptyTranscription(admin, callId, user.id)
    }

    // Step 3: Summarize with Claude Haiku
    const analysis = await analyzeWithClaude(transcript)

    // Step 4: Update the database
    const saveError = await saveTranscription(admin, callId, user.id, transcript, analysis)
    if (saveError) return saveError

    return Response.json({
      transcript,
      summary: analysis.summary,
      sentiment: analysis.sentiment,
      actionItems: analysis.actionItems,
    })
  } catch (error: unknown) {
    return handleTranscriptionError(error)
  }
}
