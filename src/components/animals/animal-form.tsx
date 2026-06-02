'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Sparkles, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react'
import { createAnimal, updateAnimal, approveAnimalDescription, rejectAnimalDescription } from '@/lib/actions/animals'
import { CommuneAutocomplete } from '@/components/ui/commune-autocomplete'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { JudicialOwnerPicker } from '@/components/animals/judicial-owner-picker'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VeterinarianSelect } from '@/components/health/veterinarian-select'
import { getBreedsForSpecies } from '@/lib/breeds'
import {
  ALL_SPECIES,
  SPECIES_LABELS,
  getIdentificationFieldsForSpecies,
  getChipLabel,
  getPassportLabel,
  getMedalLabel,
  supportsCompatibility,
  isFarmRuminantOrPorcine,
} from '@/lib/species'
import type { Animal, Box, BoxWithZone, AnimalSpecies, AnimalSex, AnimalOrigin } from '@/lib/types/database'

interface JudicialOwnerSnapshot {
  client_id: string
  name: string
  first_name: string | null
  blacklist_reason: string | null
  blacklist_source: string | null
}

interface AnimalFormProps {
  animal?: Animal
  boxes?: BoxWithZone[]
  /** Pré-rempli en mode édition si l'animal a un judicial_owner_client_id renseigné. */
  judicialOwner?: JudicialOwnerSnapshot | null
  /** Si true, affiche le bouton "Approuver et publier" sur le bloc description externe.
   * Workflow garde-fou : Carole/staff éditent le brouillon, seul l'admin peut publier. */
  canApproveDescription?: boolean
}

export function AnimalForm({ animal, boxes = [], judicialOwner = null, canApproveDescription = false }: Readonly<AnimalFormProps>) {
  const isEditing = !!animal

  // Identity fields
  const [name, setName] = useState(animal?.name || '')
  const [species, setSpecies] = useState<AnimalSpecies>(animal?.species || 'cat')
  const [sex, setSex] = useState<AnimalSex>(animal?.sex || 'unknown')
  const [originType, setOriginType] = useState<AnimalOrigin>(animal?.origin_type || 'found')
  const [breed, setBreed] = useState(animal?.breed || '')
  const [breedCross, setBreedCross] = useState(animal?.breed_cross || '')
  const [birthDate, setBirthDate] = useState(animal?.birth_date || '')
  const [birthPlace, setBirthPlace] = useState(animal?.birth_place || '')
  const [color, setColor] = useState(animal?.color || '')
  const [weight, setWeight] = useState(animal?.weight?.toString() || '')
  const [behaviorScore, setBehaviorScore] = useState(animal?.behavior_score?.toString() || '')
  const [boxId, setBoxId] = useState(animal?.box_id || '')
  const [description, setDescription] = useState(animal?.description || '')
  /** Texte actuellement VISIBLE sur sda-nord.com. Read-only dans le form sauf via "Approuver et publier". */
  const descriptionExternalPublished = animal?.description_external || ''
  /** Brouillon en cours de rédaction (par Carole, l'IA, ou Clément). Visible nulle part tant que pas approuvé. */
  const [descriptionExternalPending, setDescriptionExternalPending] = useState(
    animal?.description_external_pending || ''
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [okCats, setOkCats] = useState<boolean | null>(animal?.ok_cats ?? null)
  const [okMales, setOkMales] = useState<boolean | null>(animal?.ok_males ?? null)
  const [okFemales, setOkFemales] = useState<boolean | null>(animal?.ok_females ?? null)
  const [arrivedSterilized, setArrivedSterilized] = useState<boolean>(animal?.arrived_sterilized ?? false)
  const [sterilizedNow, setSterilizedNow] = useState<boolean>(animal?.sterilized ?? false)

  // Identification fields
  const [chipNumber, setChipNumber] = useState(animal?.chip_number || '')
  const [tattooNumber, setTattooNumber] = useState(animal?.tattoo_number || '')
  const [tattooPosition, setTattooPosition] = useState(animal?.tattoo_position || '')
  const [medalNumber, setMedalNumber] = useState(animal?.medal_number || '')
  const [loofNumber, setLoofNumber] = useState(animal?.loof_number || '')
  const [passportNumber, setPassportNumber] = useState(animal?.passport_number || '')
  const [sireNumber, setSireNumber] = useState(animal?.sire_number || '')
  const [edeNumber, setEdeNumber] = useState(animal?.ede_number || '')
  const [ringNumber, setRingNumber] = useState(animal?.ring_number || '')
  const [identificationDate, setIdentificationDate] = useState(animal?.identification_date || '')
  const [identifyingVetId, setIdentifyingVetId] = useState<string | null>(animal?.identifying_veterinarian_id || null)

  // Capture fields (only for creation)
  const [captureLocation, setCaptureLocation] = useState(animal?.capture_location || '')
  const [captureCircumstances, setCaptureCircumstances] = useState(animal?.capture_circumstances || '')

  // Procédure judiciaire
  const [judicialProcedure, setJudicialProcedure] = useState(animal?.judicial_procedure || false)
  const [judicialCaseNumber, setJudicialCaseNumber] = useState(animal?.judicial_case_number || '')
  const [judicialJurisdiction, setJudicialJurisdiction] = useState(animal?.judicial_jurisdiction || '')
  const [judicialSeizureDate, setJudicialSeizureDate] = useState(animal?.judicial_seizure_date || '')
  const [judicialOwnerName, setJudicialOwnerName] = useState(animal?.judicial_owner_name || '')
  const [judicialBillingRecipient, setJudicialBillingRecipient] = useState(animal?.judicial_billing_recipient || '')
  const [judicialNotes, setJudicialNotes] = useState(animal?.judicial_notes || '')
  // judicialPickupLocation supprimé : remplacé par le champ générique pickupAddress
  // (autocomplétion BAN, en haut du form, valable pour tous les animaux)
  const [pickupAddress, setPickupAddress] = useState<{
    label: string
    postcode: string | null
    city: string | null
    lat: number | null
    lng: number | null
    banId: string | null
  } | null>(
    animal?.pickup_address_label
      ? {
          label: animal.pickup_address_label,
          postcode: animal.pickup_postcode ?? null,
          city: animal.pickup_city ?? null,
          lat: animal.pickup_lat ?? null,
          lng: animal.pickup_lng ?? null,
          banId: animal.pickup_ban_id ?? null,
        }
      : null
  )
  const [judicialHearingDate, setJudicialHearingDate] = useState(animal?.judicial_hearing_date || '')
  const [judicialDecisionDate, setJudicialDecisionDate] = useState(animal?.judicial_decision_date || '')
  const [judicialAppealDeadline, setJudicialAppealDeadline] = useState(animal?.judicial_appeal_deadline || '')
  const [judicialLawyerName, setJudicialLawyerName] = useState(animal?.judicial_lawyer_name || '')
  const [judicialLawyerContact, setJudicialLawyerContact] = useState(animal?.judicial_lawyer_contact || '')

  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }

    startTransition(async () => {
      const data = {
        name: name.trim(),
        species,
        sex,
        origin_type: originType,
        breed: breed || null,
        breed_cross: breedCross || null,
        birth_date: birthDate || null,
        birth_place: birthPlace || null,
        color: color || null,
        weight: weight ? parseFloat(weight) : null,
        behavior_score: behaviorScore ? parseInt(behaviorScore) : null,
        box_id: boxId || null,
        description: description || null,
        // On NE touche PAS à description_external depuis le form : le seul moyen
        // de le modifier est le bouton "Approuver et publier" (garde-fou).
        description_external_pending: descriptionExternalPending || null,
        chip_number: chipNumber || null,
        tattoo_number: tattooNumber || null,
        tattoo_position: tattooPosition || null,
        medal_number: medalNumber || null,
        loof_number: loofNumber || null,
        passport_number: passportNumber || null,
        sire_number: sireNumber || null,
        ede_number: edeNumber || null,
        ring_number: ringNumber || null,
        identification_date: identificationDate || null,
        identifying_veterinarian_id: identifyingVetId || null,
        capture_location: pickupAddress?.label ?? (captureLocation || null),
        pickup_address_label: pickupAddress?.label ?? null,
        pickup_postcode: pickupAddress?.postcode ?? null,
        pickup_city: pickupAddress?.city ?? null,
        pickup_lat: pickupAddress?.lat ?? null,
        pickup_lng: pickupAddress?.lng ?? null,
        pickup_ban_id: pickupAddress?.banId ?? null,
        capture_circumstances: captureCircumstances || null,
        ok_cats: supportsCompatibility(species) ? okCats : null,
        ok_males: supportsCompatibility(species) ? okMales : null,
        ok_females: supportsCompatibility(species) ? okFemales : null,
        arrived_sterilized: arrivedSterilized,
        // Si l'animal est arrivé stérilisé, l'état actuel l'est aussi
        sterilized: arrivedSterilized || sterilizedNow,
        judicial_procedure: judicialProcedure,
        judicial_case_number: judicialProcedure ? (judicialCaseNumber.trim() || null) : null,
        judicial_jurisdiction: judicialProcedure ? (judicialJurisdiction.trim() || null) : null,
        judicial_seizure_date: judicialProcedure ? (judicialSeizureDate || null) : null,
        // Si un propriétaire client est lié, on N\\'écrase PAS judicial_owner_name
        // (mis à jour par upsertJudicialOwner via le picker). Sinon : saisie libre.
        ...(animal?.judicial_owner_client_id
          ? {}
          : { judicial_owner_name: judicialProcedure ? (judicialOwnerName.trim() || null) : null }),
        judicial_billing_recipient: judicialProcedure ? (judicialBillingRecipient.trim() || null) : null,
        judicial_notes: judicialProcedure ? (judicialNotes.trim() || null) : null,
        judicial_hearing_date: judicialProcedure ? (judicialHearingDate || null) : null,
        judicial_decision_date: judicialProcedure ? (judicialDecisionDate || null) : null,
        judicial_appeal_deadline: judicialProcedure ? (judicialAppealDeadline || null) : null,
        judicial_lawyer_name: judicialProcedure ? (judicialLawyerName.trim() || null) : null,
        judicial_lawyer_contact: judicialProcedure ? (judicialLawyerContact.trim() || null) : null,
      }

      if (isEditing) {
        const result = await updateAnimal(animal.id, data)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Animal mis a jour')
          router.push(`/animals/${animal.id}`)
        }
      } else {
        const result = await createAnimal({
          ...data,
          status: 'pound',
        })
        if ('duplicate' in result && result.duplicate) {
          const d = result.duplicate
          const created = new Date(d.created_at).toLocaleString('fr-FR')
          const message = `Un animal nommé "${d.name}" (médaille ${d.medal_number || '—'}) a déjà été créé le ${created}.\n\nVoulez-vous ouvrir ce dossier existant ?\n\nOK = ouvrir le dossier existant\nAnnuler = créer quand même un nouveau dossier`
          if (confirm(message)) {
            router.push(`/animals/${d.id}/edit`)
            return
          }
          const forced = await createAnimal({ ...data, status: 'pound', force: true })
          if (forced.error) {
            toast.error(forced.error)
          } else if (forced.data) {
            toast.success('Animal enregistre')
            router.push(`/animals/${forced.data.id}`)
          }
          return
        }
        if (result.error) {
          toast.error(result.error)
        } else if (result.data) {
          toast.success('Animal enregistre')
          router.push(`/animals/${result.data.id}`)
        }
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  const sexLabels: Record<AnimalSex, string> = { male: 'Male', female: 'Femelle', unknown: 'Inconnu' }
  const originLabels: Record<AnimalOrigin, string> = {
    found: 'Trouve',
    abandoned: 'Abandonne',
    transferred_in: 'Transfert entrant',
    surrender: 'Cession',
    requisition: 'Requisition',
    divagation: 'Divagation',
  }

  const breedSuggestions = getBreedsForSpecies(species)

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
      {/* Section: Identite */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Identite</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Nom */}
          <div>
            <label htmlFor="animal-name" className={labelClass}>Nom *</label>
            <input
              id="animal-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom de l'animal"
              required
              className={inputClass}
            />
          </div>

          {/* Espece */}
          <div>
            <label htmlFor="animal-species" className={labelClass}>Espèce *</label>
            <Select value={species} onValueChange={(v) => setSpecies(v as AnimalSpecies)}>
              <SelectTrigger id="animal-species"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_SPECIES.map((value) => (
                  <SelectItem key={value} value={value}>{SPECIES_LABELS[value]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sexe */}
          <div>
            <label htmlFor="animal-sex" className={labelClass}>Sexe *</label>
            <Select value={sex} onValueChange={(v) => setSex(v as AnimalSex)}>
              <SelectTrigger id="animal-sex"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(sexLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Origine */}
          <div>
            <label htmlFor="animal-origin" className={labelClass}>Origine *</label>
            <Select value={originType} onValueChange={(v) => setOriginType(v as AnimalOrigin)}>
              <SelectTrigger id="animal-origin"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(originLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Race */}
          <div>
            <label htmlFor="animal-breed" className={labelClass}>Race</label>
            <input
              id="animal-breed"
              type="text"
              list="breed-list"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              placeholder="Rechercher une race..."
              className={inputClass}
            />
            <datalist id="breed-list">
              {breedSuggestions.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>

          {/* Croisement */}
          <div>
            <label htmlFor="animal-breed-cross" className={labelClass}>Croisement</label>
            <input
              id="animal-breed-cross"
              type="text"
              list="breed-cross-list"
              value={breedCross}
              onChange={(e) => setBreedCross(e.target.value)}
              placeholder="Indéfini, ou autre race..."
              className={inputClass}
            />
            <datalist id="breed-cross-list">
              <option value="Indéfini" />
              {breedSuggestions.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
            {!breedCross && (
              <button
                type="button"
                onClick={() => setBreedCross('Indéfini')}
                className="text-[11px] text-muted hover:text-primary mt-1 transition-colors"
              >
                Marquer comme « Indéfini »
              </button>
            )}
          </div>

          {/* Date de naissance */}
          <div>
            <label htmlFor="animal-birth-date" className={labelClass}>Date de naissance</label>
            <DatePicker
              id="animal-birth-date"
              value={birthDate}
              onChange={(v) => setBirthDate(v ?? '')}
            />
          </div>

          {/* Lieu de naissance */}
          <div>
            <label htmlFor="animal-birth-place" className={labelClass}>Lieu de naissance</label>
            <input
              id="animal-birth-place"
              type="text"
              value={birthPlace}
              onChange={(e) => setBirthPlace(e.target.value)}
              placeholder="Lieu de naissance"
              className={inputClass}
            />
          </div>

          {/* Couleur */}
          <div>
            <label htmlFor="animal-color" className={labelClass}>Couleur / Robe</label>
            <input
              id="animal-color"
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Couleur du pelage"
              className={inputClass}
            />
          </div>

          {/* Poids */}
          <div>
            <label htmlFor="animal-weight" className={labelClass}>Poids (kg)</label>
            <input
              id="animal-weight"
              type="number"
              step="0.1"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Ex: 4.5"
              className={inputClass}
            />
          </div>

          {/* Score comportemental */}
          <div>
            <label htmlFor="animal-behavior-score" className={labelClass}>Score comportemental</label>
            <Select value={behaviorScore || '__none__'} onValueChange={(v) => setBehaviorScore(v === '__none__' ? '' : v)}>
              <SelectTrigger id="animal-behavior-score"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Non évalué</SelectItem>
                <SelectItem value="1">1 — Très sociable</SelectItem>
                <SelectItem value="2">2 — Sociable</SelectItem>
                <SelectItem value="3">3 — Réservé</SelectItem>
                <SelectItem value="4">4 — Craintif</SelectItem>
                <SelectItem value="5">5 — Agressif</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Box */}
          <div>
            <label htmlFor="animal-box" className={labelClass}>Box</label>
            <Select value={boxId || '__none__'} onValueChange={(v) => setBoxId(v === '__none__' ? '' : v)}>
              <SelectTrigger id="animal-box"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Aucun box</SelectItem>
                {boxes.map((box) => {
                  const zoneName = box.zone?.name
                  const speciesLabel = box.species_type === 'mixed' ? 'Mixte' : box.species_type === 'farm' ? 'Ferme' : box.species_type === 'other' ? 'Autres' : SPECIES_LABELS[box.species_type as AnimalSpecies] || box.species_type
                  return (
                    <SelectItem key={box.id} value={box.id}>
                      {zoneName ? `${zoneName} — ${box.name}` : box.name} ({speciesLabel})
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stérilisation à l'arrivée */}
        <div className="col-span-full mt-4">
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={arrivedSterilized}
                onChange={(e) => {
                  setArrivedSterilized(e.target.checked)
                  if (e.target.checked) setSterilizedNow(true)
                }}
              />
              <span>Arrivé déjà stérilisé(e)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={sterilizedNow}
                onChange={(e) => setSterilizedNow(e.target.checked)}
                disabled={arrivedSterilized}
              />
              <span>Actuellement stérilisé(e){arrivedSterilized ? ' (auto)' : ''}</span>
            </label>
          </div>
        </div>

        {/* Compatibilite - dogs only */}
        {supportsCompatibility(species) && (
          <div className="col-span-full mt-4">
            <p className={labelClass}>Compatibilite</p>
            <div className="flex flex-wrap gap-3">
              {([
                { label: 'OK chats', value: okCats, setter: setOkCats },
                { label: 'OK males', value: okMales, setter: setOkMales },
                { label: 'OK femelles', value: okFemales, setter: setOkFemales },
              ] as const).map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="text-sm">{item.label}</span>
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    {([
                      { val: true, text: 'Oui', color: 'bg-green-500 text-white' },
                      { val: null, text: '?', color: 'bg-surface-hover text-muted' },
                      { val: false, text: 'Non', color: 'bg-red-500 text-white' },
                    ] as const).map((opt) => (
                      <button
                        key={String(opt.val)}
                        type="button"
                        onClick={() => item.setter(opt.val)}
                        className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                          item.value === opt.val ? opt.color : 'bg-surface text-muted hover:bg-surface-hover'
                        }`}
                      >
                        {opt.text}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description interne - full width */}
        <div className="mt-4">
          <label htmlFor="animal-description" className={labelClass}>Description interne</label>
          <textarea
            id="animal-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes internes : comportement, particularites, infos medicales..."
            rows={3}
            className={`${inputClass} resize-y`}
          />
        </div>

        {/* Description externe (publique) — workflow garde-fou avec brouillon
            séparé du texte publié. Carole/staff éditent le brouillon, l'admin
            valide via "Approuver et publier". */}
        <div className="mt-4 space-y-4 p-4 rounded-xl border border-border bg-surface-dark/30">
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-muted">
              <strong className="text-text">Garde-fou éditorial</strong> — Le brouillon (en bas) est invisible côté site sda-nord.com tant qu&apos;un admin n&apos;a pas cliqué <em>Approuver et publier</em>. Carole / l&apos;IA / le staff travaillent sur le brouillon ; seul Clément peut publier.
            </p>
          </div>

          {/* Texte publié (read-only) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="animal-description-external-published" className={labelClass}>
                Texte publié sur sda-nord.com
              </label>
              <span className="text-[11px] text-muted">
                {descriptionExternalPublished
                  ? `${descriptionExternalPublished.length} caractères`
                  : 'Aucun texte publié'}
              </span>
            </div>
            <textarea
              id="animal-description-external-published"
              value={descriptionExternalPublished}
              readOnly
              placeholder="Aucun texte publié sur le site pour cet animal. Rédigez un brouillon ci-dessous puis approuvez-le."
              rows={6}
              className={`${inputClass} resize-y font-serif leading-relaxed bg-surface/50 cursor-not-allowed opacity-80`}
            />
          </div>

          {/* Brouillon (éditable) + bouton IA */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="animal-description-external-pending" className={labelClass}>
                Brouillon (en attente d&apos;approbation)
              </label>
              <button
                type="button"
                disabled={isGenerating || !animal?.id}
                onClick={async () => {
                  if (!animal?.id) return
                  setIsGenerating(true)
                  try {
                    const res = await fetch('/api/ai/generate-description', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ animalId: animal.id }),
                    })
                    const data = await res.json()
                    if (res.ok && data.content) {
                      setDescriptionExternalPending(data.content)
                      toast.success('Brouillon généré. Relis-le puis clique "Approuver et publier".')
                    } else {
                      alert(data.error || 'Erreur lors de la génération')
                    }
                  } catch {
                    alert('Erreur réseau')
                  } finally {
                    setIsGenerating(false)
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Génération...</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" /> Générer avec l&apos;IA</>
                )}
              </button>
            </div>
            <textarea
              id="animal-description-external-pending"
              value={descriptionExternalPending}
              onChange={(e) => setDescriptionExternalPending(e.target.value)}
              placeholder={animal?.id ? "Cliquez 'Générer avec l'IA' ou rédigez manuellement le brouillon..." : "Enregistrez l'animal d'abord pour générer avec l'IA"}
              rows={20}
              className={`${inputClass} resize-y font-serif leading-relaxed`}
            />
            <p className="text-[11px] text-muted mt-1">
              {descriptionExternalPending.length} caractères · Le brouillon est sauvegardé avec le reste du formulaire (bouton Enregistrer en bas).
            </p>
          </div>

          {/* Boutons admin (Approuver / Rejeter) */}
          {canApproveDescription && descriptionExternalPending && animal?.id && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              <button
                type="button"
                disabled={isApproving}
                onClick={async () => {
                  if (!animal?.id) return
                  if (!confirm("Approuver ce brouillon ? Il remplacera immédiatement le texte publié sur sda-nord.com.")) return
                  setIsApproving(true)
                  try {
                    const res = await approveAnimalDescription(animal.id)
                    if (res.error) {
                      toast.error(res.error)
                    } else {
                      toast.success('Brouillon approuvé et publié.')
                      router.refresh()
                    }
                  } finally {
                    setIsApproving(false)
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-success text-white hover:bg-success/90 disabled:opacity-50 transition-colors"
              >
                {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Approuver et publier
              </button>
              <button
                type="button"
                disabled={isApproving}
                onClick={async () => {
                  if (!animal?.id) return
                  const reason = prompt("Rejeter ce brouillon. Raison (optionnelle, affichée dans le log) :")
                  if (reason === null) return
                  setIsApproving(true)
                  try {
                    const res = await rejectAnimalDescription(animal.id, reason || undefined)
                    if (res.error) {
                      toast.error(res.error)
                    } else {
                      toast.success('Brouillon rejeté.')
                      setDescriptionExternalPending('')
                      router.refresh()
                    }
                  } finally {
                    setIsApproving(false)
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-red-500/15 text-red-500 hover:bg-red-500/25 disabled:opacity-50 transition-colors"
              >
                <XCircle className="w-4 h-4" /> Rejeter
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Section: Identification */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Identification</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(() => {
            const fields = getIdentificationFieldsForSpecies(species)
            return (
              <>
                {fields.includes('chip_number') && (
                  <div>
                    <label htmlFor="animal-chip-number" className={labelClass}>{getChipLabel(species)}</label>
                    <input
                      id="animal-chip-number"
                      type="text"
                      value={chipNumber}
                      onChange={(e) => setChipNumber(e.target.value)}
                      placeholder="250..."
                      className={inputClass}
                    />
                  </div>
                )}

                {fields.includes('tattoo') && (
                  <>
                    <div>
                      <label htmlFor="animal-tattoo-number" className={labelClass}>Numéro de tatouage</label>
                      <input
                        id="animal-tattoo-number"
                        type="text"
                        value={tattooNumber}
                        onChange={(e) => setTattooNumber(e.target.value)}
                        placeholder="Numéro de tatouage"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label htmlFor="animal-tattoo-position" className={labelClass}>Position du tatouage</label>
                      <input
                        id="animal-tattoo-position"
                        type="text"
                        value={tattooPosition}
                        onChange={(e) => setTattooPosition(e.target.value)}
                        placeholder="Oreille droite, cuisse..."
                        className={inputClass}
                      />
                    </div>
                  </>
                )}

                {fields.includes('medal_number') && (
                  <div>
                    <label htmlFor="animal-medal-number" className={labelClass}>{getMedalLabel(species)}</label>
                    {isFarmRuminantOrPorcine(species) ? (
                      // Boucle d'oreille d'élevage : saisie libre (l'animal arrive avec sa boucle)
                      <input
                        id="animal-medal-number"
                        type="text"
                        value={medalNumber}
                        onChange={(e) => setMedalNumber(e.target.value)}
                        placeholder="N° de la boucle existante"
                        className={inputClass}
                      />
                    ) : isEditing ? (
                      <input
                        id="animal-medal-number"
                        type="text"
                        value={medalNumber}
                        readOnly
                        className={`${inputClass} opacity-60 cursor-not-allowed`}
                      />
                    ) : (
                      <div className={`${inputClass} opacity-60 cursor-not-allowed text-muted`}>
                        Auto-généré
                      </div>
                    )}
                  </div>
                )}

                {fields.includes('loof_number') && (
                  <div>
                    <label htmlFor="animal-loof-number" className={labelClass}>Numéro LOOF</label>
                    <input
                      id="animal-loof-number"
                      type="text"
                      value={loofNumber}
                      onChange={(e) => setLoofNumber(e.target.value)}
                      placeholder="Numéro LOOF"
                      className={inputClass}
                    />
                  </div>
                )}

                {fields.includes('passport_number') && (
                  <div>
                    <label htmlFor="animal-passport-number" className={labelClass}>{getPassportLabel(species)}</label>
                    <input
                      id="animal-passport-number"
                      type="text"
                      value={passportNumber}
                      onChange={(e) => setPassportNumber(e.target.value)}
                      placeholder="Numéro de passeport"
                      className={inputClass}
                    />
                  </div>
                )}

                {fields.includes('sire_number') && (
                  <div>
                    <label htmlFor="animal-sire-number" className={labelClass}>Numéro SIRE</label>
                    <input
                      id="animal-sire-number"
                      type="text"
                      value={sireNumber}
                      onChange={(e) => setSireNumber(e.target.value)}
                      placeholder="Numéro SIRE équidé"
                      className={inputClass}
                    />
                  </div>
                )}

                {fields.includes('ede_number') && (
                  <div>
                    <label htmlFor="animal-ede-number" className={labelClass}>Numéro EDE / cheptel</label>
                    <input
                      id="animal-ede-number"
                      type="text"
                      value={edeNumber}
                      onChange={(e) => setEdeNumber(e.target.value)}
                      placeholder="N° EDE de l&apos;élevage"
                      className={inputClass}
                    />
                  </div>
                )}

                {fields.includes('ring_number') && (
                  <div>
                    <label htmlFor="animal-ring-number" className={labelClass}>Numéro de bague</label>
                    <input
                      id="animal-ring-number"
                      type="text"
                      value={ringNumber}
                      onChange={(e) => setRingNumber(e.target.value)}
                      placeholder="N° de bague"
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="animal-identification-date" className={labelClass}>Date d&apos;identification</label>
                  <DatePicker
                    id="animal-identification-date"
                    value={identificationDate}
                    onChange={(v) => setIdentificationDate(v ?? '')}
                  />
                </div>

                <div className="md:col-span-2 lg:col-span-2">
                  <VeterinarianSelect
                    id="animal-identifying-vet"
                    value={identifyingVetId}
                    onChange={(vetId) => setIdentifyingVetId(vetId)}
                    inputClass={inputClass}
                    labelClass={labelClass}
                    label="Vétérinaire identifiant"
                  />
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {/* Section: Lieu de récupération (toujours visible, édition possible post-création) */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-1">
          Lieu de récupération
        </h3>
        <p className="text-xs text-muted mb-4">
          Adresse précise où l&apos;animal a été récupéré (saisie judiciaire, divagation, abandon, transfert...).
          Sélectionne obligatoirement une adresse dans la liste pour normaliser l&apos;écriture.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="animal-pickup-address" className={labelClass}>Adresse</label>
            <AddressAutocomplete
              id="animal-pickup-address"
              value={pickupAddress}
              onChange={setPickupAddress}
              placeholder="12 rue Saint-Nicolas, 59400 Cambrai..."
            />
            {pickupAddress?.city && (
              <p className="text-[11px] text-muted mt-1">
                Code postal : <span className="text-text font-semibold">{pickupAddress.postcode ?? '—'}</span>
                {' · '}
                Ville : <span className="text-text font-semibold">{pickupAddress.city}</span>
              </p>
            )}
          </div>

          <div>
            <label htmlFor="animal-capture-circumstances" className={labelClass}>Circonstances</label>
            <textarea
              id="animal-capture-circumstances"
              value={captureCircumstances}
              onChange={(e) => setCaptureCircumstances(e.target.value)}
              placeholder="Circonstances de la récupération..."
              rows={3}
              className={`${inputClass} resize-y`}
            />
          </div>
        </div>
      </div>

      {/* Ancien bloc capture (compat) — supprimé : remplacé par la section ci-dessus */}
      {false && (
        <div className="bg-surface rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Lieu de capture</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lieu de capture */}
            <div>
              <label className={labelClass}>
                Lieu de capture
                <CommuneAutocomplete
                  value={captureLocation}
                  onChange={setCaptureLocation}
                  placeholder="Commune de capture"
                  className={inputClass}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Section: Procédure judiciaire */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={judicialProcedure}
            onChange={(e) => setJudicialProcedure(e.target.checked)}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="text-sm font-semibold flex items-center gap-2">
              <span>⚖️ Animal en procédure judiciaire</span>
              {judicialProcedure && (
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-error/15 text-error">
                  EN PROCÉDURE
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-0.5">
              Cocher si l&apos;animal fait l&apos;objet d&apos;une procédure (réquisition, saisie). Les actes vétérinaires devront être facturés nominativement pour remboursement tribunal.
            </p>
          </div>
        </label>

        {judicialProcedure && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 pl-7">
            <div>
              <label htmlFor="judicial-case" className={labelClass}>N° de dossier</label>
              <input
                id="judicial-case"
                type="text"
                value={judicialCaseNumber}
                onChange={(e) => setJudicialCaseNumber(e.target.value)}
                placeholder="Ex: 2026/123"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="judicial-jur" className={labelClass}>Juridiction</label>
              <input
                id="judicial-jur"
                type="text"
                value={judicialJurisdiction}
                onChange={(e) => setJudicialJurisdiction(e.target.value)}
                placeholder="Tribunal de Cambrai..."
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="judicial-date" className={labelClass}>Date de saisine / réquisition</label>
              <DatePicker
                id="judicial-date"
                value={judicialSeizureDate}
                onChange={(v) => setJudicialSeizureDate(v ?? '')}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Propriétaire mis en cause</label>
              {isEditing && animal ? (
                <JudicialOwnerPicker
                  animalId={animal.id}
                  animalName={animal.name}
                  current={judicialOwner}
                  canEdit
                />
              ) : (
                <>
                  <input
                    id="judicial-owner"
                    type="text"
                    value={judicialOwnerName}
                    onChange={(e) => setJudicialOwnerName(e.target.value)}
                    placeholder="Nom complet (sera lié à une fiche après création)"
                    className={inputClass}
                  />
                  <p className="text-xs text-muted mt-1">
                    Saisie libre pour le moment. Après création de l&apos;animal, vous pourrez lier ce propriétaire à une vraie fiche contact (et l&apos;inscrire sur la liste noire SDA).
                  </p>
                </>
              )}
            </div>
            <div className="md:col-span-2">
              <label htmlFor="judicial-billing" className={labelClass}>Destinataire facturation (clinique → SDA)</label>
              <input
                id="judicial-billing"
                type="text"
                value={judicialBillingRecipient}
                onChange={(e) => setJudicialBillingRecipient(e.target.value)}
                placeholder="SDA — pour remboursement tribunal"
                className={inputClass}
              />
              <p className="text-xs text-muted mt-1">
                Précisez à qui la clinique doit adresser sa facture (par défaut : SDA pour récupération auprès du tribunal).
              </p>
            </div>
            {/* Lieu de récupération désormais dans la section générique "Lieu de récupération" en haut du form */}
            <div>
              <label htmlFor="judicial-hearing" className={labelClass}>Date d&apos;audience</label>
              <DatePicker
                id="judicial-hearing"
                value={judicialHearingDate}
                onChange={(v) => setJudicialHearingDate(v ?? '')}
              />
            </div>
            <div>
              <label htmlFor="judicial-decision" className={labelClass}>Date du jugement</label>
              <DatePicker
                id="judicial-decision"
                value={judicialDecisionDate}
                onChange={(v) => setJudicialDecisionDate(v ?? '')}
              />
            </div>
            <div>
              <label htmlFor="judicial-appeal" className={labelClass}>Délai d&apos;appel (date limite)</label>
              <DatePicker
                id="judicial-appeal"
                value={judicialAppealDeadline}
                onChange={(v) => setJudicialAppealDeadline(v ?? '')}
              />
            </div>
            <div>
              <label htmlFor="judicial-lawyer-name" className={labelClass}>Avocat / représentant</label>
              <input
                id="judicial-lawyer-name"
                type="text"
                value={judicialLawyerName}
                onChange={(e) => setJudicialLawyerName(e.target.value)}
                placeholder="Maître X / Avocat de la SDA"
                className={inputClass}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="judicial-lawyer-contact" className={labelClass}>Contact avocat (email / téléphone)</label>
              <input
                id="judicial-lawyer-contact"
                type="text"
                value={judicialLawyerContact}
                onChange={(e) => setJudicialLawyerContact(e.target.value)}
                placeholder="cabinet@avocat.fr / 03 27 ..."
                className={inputClass}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="judicial-notes" className={labelClass}>Notes procédure</label>
              <textarea
                id="judicial-notes"
                value={judicialNotes}
                onChange={(e) => setJudicialNotes(e.target.value)}
                rows={2}
                placeholder="Notes libres, contacts complémentaires..."
                className={`${inputClass} resize-y`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 rounded-lg text-sm font-medium text-muted border border-border
            hover:bg-surface-dark transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 py-3 rounded-lg font-semibold text-white text-sm
            gradient-primary hover:opacity-90 transition-opacity
            disabled:opacity-50 disabled:cursor-not-allowed
            shadow-lg shadow-primary/25"
        >
          {(() => {
            if (isPending) return 'Enregistrement...'
            if (isEditing) return 'Mettre a jour'
            return 'Enregistrer l\'animal'
          })()}
        </button>
      </div>
    </form>
  )
}
