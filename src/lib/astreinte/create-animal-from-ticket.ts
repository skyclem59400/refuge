import { createAdminClient } from '@/lib/supabase/server'
import { pickAnimalName } from './intervention-names'

const ASTREINTE_PHOTOS_BUCKET = 'astreinte-photos'
const ANIMALS_BUCKET = 'animal-photos'

interface AstreinteTicket {
  id: string
  ticket_number: string
  animal_species: string | null
  animal_breed: string | null
  animal_color: string | null
  animal_size: string | null
  animal_dangerous: boolean | null
  description: string | null
  location_address: string | null
  intervention_destination: string | null
  intervention_comments: string | null
  optimus_animal_id: string | null
  completed_at: string | null
}

interface CreateAnimalResult {
  animalId: string
  animalName: string
}

/**
 * Crée automatiquement un animal dans Optimus à partir d'un ticket astreinte
 * récupéré (refuge_sda OU veterinary). Idempotent : si optimus_animal_id est
 * déjà rempli, retourne l'existant.
 */
export async function createAnimalFromTicket(
  ticketId: string,
  establishmentId: string
): Promise<CreateAnimalResult | null> {
  const admin = createAdminClient()

  const { data: ticket } = await admin
    .from('astreinte_tickets')
    .select(
      'id, ticket_number, animal_species, animal_breed, animal_color, animal_size, animal_dangerous, description, location_address, intervention_destination, intervention_comments, optimus_animal_id, completed_at'
    )
    .eq('id', ticketId)
    .single<AstreinteTicket>()

  if (!ticket) return null

  // Déjà créé : retourner l'existant (idempotence)
  if (ticket.optimus_animal_id) {
    const { data: existing } = await admin
      .from('animals')
      .select('id, name')
      .eq('id', ticket.optimus_animal_id)
      .maybeSingle()
    if (existing) return { animalId: existing.id, animalName: existing.name }
  }

  // Filtre : on ne crée que pour refuge_sda et veterinary
  if (
    ticket.intervention_destination !== 'refuge_sda' &&
    ticket.intervention_destination !== 'veterinary'
  ) {
    return null
  }

  const animalName = pickAnimalName(ticket.animal_species, ticket.id)

  // Mapping espèce ticket → espèce animals
  const speciesText =
    ticket.animal_species === 'dog'
      ? 'dog'
      : ticket.animal_species === 'cat'
        ? 'cat'
        : 'other'

  const captureCircumstancesParts: string[] = []
  if (ticket.description) captureCircumstancesParts.push(ticket.description)
  if (ticket.intervention_comments) {
    captureCircumstancesParts.push(`Intervention : ${ticket.intervention_comments}`)
  }
  const captureCircumstances =
    captureCircumstancesParts.join('\n\n') ||
    `Recueil suite à intervention astreinte ${ticket.ticket_number}.`

  const today = new Date().toISOString().slice(0, 10)
  const isVeterinary = ticket.intervention_destination === 'veterinary'
  const vetSuffix = isVeterinary
    ? '\n\n[Animal en garde à la clinique vétérinaire avant transfert au refuge.]'
    : ''

  const { data: created, error } = await admin
    .from('animals')
    .insert({
      establishment_id: establishmentId,
      name: animalName,
      species: speciesText,
      sex: 'unknown',
      breed: ticket.animal_breed,
      color: ticket.animal_color,
      description: null,
      capture_location: ticket.location_address,
      capture_circumstances: captureCircumstances + vetSuffix,
      origin_type: 'astreinte_pickup',
      status: 'pound',
      pound_entry_date: today,
      adoptable: false,
      arrived_sterilized: false,
      sterilized: false,
    })
    .select('id, name')
    .single<{ id: string; name: string }>()

  if (error || !created) {
    console.error('[astreinte] createAnimalFromTicket insert error:', error)
    throw new Error(`Création animal échouée : ${error?.message ?? 'inconnu'}`)
  }

  // Copier la première photo du ticket vers le bucket animals (preview)
  const { data: photos } = await admin
    .from('astreinte_ticket_photos')
    .select('storage_path, mime_type')
    .eq('ticket_id', ticketId)
    .order('uploaded_at', { ascending: true })
    .limit(1)

  if (photos && photos.length > 0) {
    const photo = photos[0]
    const { data: download } = await admin.storage
      .from(ASTREINTE_PHOTOS_BUCKET)
      .download(photo.storage_path)

    if (download) {
      const ext = photo.mime_type.includes('png')
        ? 'png'
        : photo.mime_type.includes('webp')
          ? 'webp'
          : 'jpg'
      const newPath = `${created.id}/photo-astreinte.${ext}`
      const { error: uploadError } = await admin.storage
        .from(ANIMALS_BUCKET)
        .upload(newPath, download, {
          contentType: photo.mime_type,
          upsert: true,
        })

      if (!uploadError) {
        const { data: signed } = await admin.storage
          .from(ANIMALS_BUCKET)
          .createSignedUrl(newPath, 60 * 60 * 24 * 365)
        if (signed?.signedUrl) {
          await admin
            .from('animals')
            .update({ photo_url: signed.signedUrl })
            .eq('id', created.id)
        }
      }
    }
  }

  // Lien retour ticket → animal
  await admin
    .from('astreinte_tickets')
    .update({ optimus_animal_id: created.id })
    .eq('id', ticketId)

  return { animalId: created.id, animalName: created.name }
}
