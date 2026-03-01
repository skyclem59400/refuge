import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
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

    if (call.transcribed_at) {
      return Response.json({ error: 'Cet appel a deja ete transcrit' }, { status: 409 })
    }

    // Determine audio URL (prefer recording over voicemail — recording is the full conversation)
    const audioUrl = call.recording_url || call.voicemail_url
    if (!audioUrl) {
      return Response.json({ error: 'Aucun fichier audio disponible' }, { status: 400 })
    }

    // ── Step 1: Download the MP3 ──
    const audioResponse = await fetch(audioUrl)
    if (!audioResponse.ok) {
      return Response.json(
        { error: `Impossible de telecharger l'audio (${audioResponse.status})` },
        { status: 502 }
      )
    }

    const audioBuffer = await audioResponse.arrayBuffer()
    const audioFile = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' })

    // ── Step 2: Transcribe with Whisper ──
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      language: 'fr',
      response_format: 'text',
    })

    const transcript = typeof transcription === 'string'
      ? transcription
      : (transcription as unknown as { text: string }).text

    // Treat very short transcripts (< 5 chars) as silence — Whisper sometimes returns noise artifacts
    if (!transcript || transcript.trim().length < 5) {
      await admin
        .from('ringover_calls')
        .update({
          transcript: '(Aucune parole detectee)',
          transcribed_at: new Date().toISOString(),
          transcribed_by: user.id,
        })
        .eq('id', callId)

      return Response.json({
        transcript: '(Aucune parole detectee)',
        summary: null,
        sentiment: null,
        actionItems: [],
      })
    }

    // ── Step 3: Summarize with Claude Haiku ──
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
    // Strip markdown code fences (```json ... ```) that Claude sometimes adds
    // Use a greedy match to handle all variations of code fence formatting
    let aiText = rawAiText.trim()
    const fenceMatch = aiText.match(/^```\w*\s*\n?([\s\S]*?)\n?\s*```\s*$/)
    if (fenceMatch) aiText = fenceMatch[1].trim()
    // Also try to extract just the JSON object if there's surrounding text
    if (!aiText.startsWith('{')) {
      const jsonMatch = aiText.match(/(\{[\s\S]*\})/)
      if (jsonMatch) aiText = jsonMatch[1]
    }

    let summary: string | null = null
    let sentiment: string | null = null
    let actionItems: { text: string; completed: boolean }[] = []

    try {
      const parsed = JSON.parse(aiText)
      summary = parsed.summary || null
      sentiment = ['positive', 'neutral', 'negative'].includes(parsed.sentiment)
        ? parsed.sentiment
        : null
      actionItems = (parsed.action_items || []).map((item: string) => ({
        text: item,
        completed: false,
      }))
    } catch {
      summary = aiText.slice(0, 500)
    }

    // ── Step 4: Update the database ──
    const { error: updateError } = await admin
      .from('ringover_calls')
      .update({
        transcript,
        transcript_language: 'fr',
        ai_summary: summary,
        ai_sentiment: sentiment,
        ai_action_items: actionItems,
        transcribed_at: new Date().toISOString(),
        transcribed_by: user.id,
      })
      .eq('id', callId)

    if (updateError) {
      return Response.json(
        { error: `Erreur de sauvegarde: ${updateError.message}` },
        { status: 500 }
      )
    }

    return Response.json({ transcript, summary, sentiment, actionItems })
  } catch (error: unknown) {
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
}
