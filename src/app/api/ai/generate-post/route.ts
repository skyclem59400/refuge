import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getSpeciesLabel, getSexLabel, calculateAge } from '@/lib/sda-utils'

export async function POST(request: NextRequest) {
  try {
    // Check API key configuration
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

    // Parse request body
    const { animalId, postType, platform, additionalNotes } = await request.json() as {
      animalId: string
      postType: 'search_owner' | 'adoption'
      platform: 'facebook' | 'instagram' | 'both'
      additionalNotes?: string
    }

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

    // Build labels
    const speciesLabel = getSpeciesLabel(animal.species)
    const sexLabel = getSexLabel(animal.sex)
    const ageStr = calculateAge(animal.birth_date)

    const chipInfo = animal.chip_number
      ? `Puce ${animal.chip_number}`
      : animal.tattoo_number
        ? `Tatouage ${animal.tattoo_number}`
        : 'Non identifie'

    const formattedDate = animal.pound_entry_date
      ? new Date(animal.pound_entry_date).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'Non precisee'

    // Platform-specific instructions
    const platformLabels: Record<string, string> = {
      facebook: 'Facebook',
      instagram: 'Instagram',
      both: 'Facebook et Instagram',
    }
    const platformLabel = platformLabels[platform]

    const platformInstructions: Record<string, string> = {
      facebook:
        'Format adapte a Facebook : paragraphes aeres, longueur moyenne (150-250 mots)',
      instagram:
        'Format adapte a Instagram : texte plus court (100-150 mots), terminer par quelques hashtags pertinents (#adoption #refuge #SDAEstormel)',
      both:
        'Format adapte a Facebook et Instagram : texte polyvalent (150-200 mots), terminer par quelques hashtags',
    }

    // Build prompt based on post type
    let prompt: string

    if (postType === 'search_owner') {
      prompt = `Tu es un redacteur pour la SDA Estormel, refuge animalier dans le Nord de la France.
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
- ${platformInstructions[platform]}
- Ne pas mettre de hashtags en plein milieu du texte`
    } else {
      prompt = `Tu es un redacteur pour la SDA Estormel, refuge animalier dans le Nord de la France.
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
- ${platformInstructions[platform]}
- Terminer par un appel a l'action`
    }

    // Call Claude API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const generatedText =
      message.content[0].type === 'text' ? message.content[0].text : ''

    return Response.json({ content: generatedText })
  } catch (error) {
    console.error('AI generation error:', error)
    return Response.json(
      { error: 'Erreur lors de la generation' },
      { status: 500 }
    )
  }
}
