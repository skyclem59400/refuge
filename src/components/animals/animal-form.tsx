'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Sparkles } from 'lucide-react'
import { createAnimal, updateAnimal } from '@/lib/actions/animals'
import { CommuneAutocomplete } from '@/components/ui/commune-autocomplete'
import { VeterinarianSelect } from '@/components/health/veterinarian-select'
import { getBreedsForSpecies } from '@/lib/breeds'
import type { Animal, Box, AnimalSpecies, AnimalSex, AnimalOrigin } from '@/lib/types/database'

interface AnimalFormProps {
  animal?: Animal
  boxes?: Box[]
}

export function AnimalForm({ animal, boxes = [] }: Readonly<AnimalFormProps>) {
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
  const [descriptionExternal, setDescriptionExternal] = useState(animal?.description_external || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [okCats, setOkCats] = useState<boolean | null>(animal?.ok_cats ?? null)
  const [okMales, setOkMales] = useState<boolean | null>(animal?.ok_males ?? null)
  const [okFemales, setOkFemales] = useState<boolean | null>(animal?.ok_females ?? null)

  // Identification fields
  const [chipNumber, setChipNumber] = useState(animal?.chip_number || '')
  const [tattooNumber, setTattooNumber] = useState(animal?.tattoo_number || '')
  const [tattooPosition, setTattooPosition] = useState(animal?.tattoo_position || '')
  const [medalNumber] = useState(animal?.medal_number || '')
  const [loofNumber, setLoofNumber] = useState(animal?.loof_number || '')
  const [passportNumber, setPassportNumber] = useState(animal?.passport_number || '')
  const [identificationDate, setIdentificationDate] = useState(animal?.identification_date || '')
  const [identifyingVetId, setIdentifyingVetId] = useState<string | null>(animal?.identifying_veterinarian_id || null)

  // Capture fields (only for creation)
  const [captureLocation, setCaptureLocation] = useState(animal?.capture_location || '')
  const [captureCircumstances, setCaptureCircumstances] = useState(animal?.capture_circumstances || '')

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
        description_external: descriptionExternal || null,
        chip_number: chipNumber || null,
        tattoo_number: tattooNumber || null,
        tattoo_position: tattooPosition || null,
        medal_number: medalNumber || null,
        loof_number: loofNumber || null,
        passport_number: passportNumber || null,
        identification_date: identificationDate || null,
        identifying_veterinarian_id: identifyingVetId || null,
        capture_location: captureLocation || null,
        capture_circumstances: captureCircumstances || null,
        ok_cats: species === 'dog' ? okCats : null,
        ok_males: species === 'dog' ? okMales : null,
        ok_females: species === 'dog' ? okFemales : null,
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
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Animal enregistre')
          router.push(`/animals/${result.data!.id}`)
        }
      }
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  const speciesLabels: Record<AnimalSpecies, string> = { cat: 'Chat', dog: 'Chien' }
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
            <label htmlFor="animal-species" className={labelClass}>Espece *</label>
            <select
              id="animal-species"
              value={species}
              onChange={(e) => setSpecies(e.target.value as AnimalSpecies)}
              className={inputClass}
            >
              {Object.entries(speciesLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Sexe */}
          <div>
            <label htmlFor="animal-sex" className={labelClass}>Sexe *</label>
            <select
              id="animal-sex"
              value={sex}
              onChange={(e) => setSex(e.target.value as AnimalSex)}
              className={inputClass}
            >
              {Object.entries(sexLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Origine */}
          <div>
            <label htmlFor="animal-origin" className={labelClass}>Origine *</label>
            <select
              id="animal-origin"
              value={originType}
              onChange={(e) => setOriginType(e.target.value as AnimalOrigin)}
              className={inputClass}
            >
              {Object.entries(originLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
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
              placeholder="Croise avec..."
              className={inputClass}
            />
            <datalist id="breed-cross-list">
              {breedSuggestions.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>

          {/* Date de naissance */}
          <div>
            <label htmlFor="animal-birth-date" className={labelClass}>Date de naissance</label>
            <input
              id="animal-birth-date"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className={inputClass}
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
            <select
              id="animal-behavior-score"
              value={behaviorScore}
              onChange={(e) => setBehaviorScore(e.target.value)}
              className={inputClass}
            >
              <option value="">Non evalue</option>
              <option value="1">1 - Tres sociable</option>
              <option value="2">2 - Sociable</option>
              <option value="3">3 - Reserve</option>
              <option value="4">4 - Craintif</option>
              <option value="5">5 - Agressif</option>
            </select>
          </div>

          {/* Box */}
          <div>
            <label htmlFor="animal-box" className={labelClass}>Box</label>
            <select
              id="animal-box"
              value={boxId}
              onChange={(e) => setBoxId(e.target.value)}
              className={inputClass}
            >
              <option value="">Aucun box</option>
              {boxes.map((box) => (
                <option key={box.id} value={box.id}>
                  {box.name} ({(() => { if (box.species_type === 'cat') return 'Chats'; if (box.species_type === 'dog') return 'Chiens'; return 'Mixte'; })()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Compatibilite - dogs only */}
        {species === 'dog' && (
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

        {/* Description externe (publique) - full width */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="animal-description-external" className={labelClass}>Description externe (publique)</label>
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
                    setDescriptionExternal(data.content)
                  } else {
                    alert(data.error || 'Erreur lors de la generation')
                  }
                } catch {
                  alert('Erreur reseau')
                } finally {
                  setIsGenerating(false)
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generation...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> Generer avec l&apos;IA</>
              )}
            </button>
          </div>
          <textarea
            id="animal-description-external"
            value={descriptionExternal}
            onChange={(e) => setDescriptionExternal(e.target.value)}
            placeholder={animal?.id ? "Cliquez sur 'Generer avec l'IA' ou redigez manuellement..." : "Enregistrez l'animal d'abord pour generer avec l'IA"}
            rows={5}
            className={`${inputClass} resize-y`}
          />
        </div>
      </div>

      {/* Section: Identification */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Identification</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Numero de puce */}
          <div>
            <label htmlFor="animal-chip-number" className={labelClass}>Numero de puce</label>
            <input
              id="animal-chip-number"
              type="text"
              value={chipNumber}
              onChange={(e) => setChipNumber(e.target.value)}
              placeholder="250..."
              className={inputClass}
            />
          </div>

          {/* Numero de tatouage */}
          <div>
            <label htmlFor="animal-tattoo-number" className={labelClass}>Numero de tatouage</label>
            <input
              id="animal-tattoo-number"
              type="text"
              value={tattooNumber}
              onChange={(e) => setTattooNumber(e.target.value)}
              placeholder="Numero de tatouage"
              className={inputClass}
            />
          </div>

          {/* Position tatouage */}
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

          {/* Numero de medaille */}
          <div>
            <label htmlFor="animal-medal-number" className={labelClass}>Numero de medaille</label>
            {isEditing ? (
              <input
                id="animal-medal-number"
                type="text"
                value={medalNumber}
                readOnly
                className={`${inputClass} opacity-60 cursor-not-allowed`}
              />
            ) : (
              <div className={`${inputClass} opacity-60 cursor-not-allowed text-muted`}>
                Auto-genere
              </div>
            )}
          </div>

          {/* Numero LOOF */}
          <div>
            <label htmlFor="animal-loof-number" className={labelClass}>Numero LOOF</label>
            <input
              id="animal-loof-number"
              type="text"
              value={loofNumber}
              onChange={(e) => setLoofNumber(e.target.value)}
              placeholder="Numero LOOF"
              className={inputClass}
            />
          </div>

          {/* Numero de passeport */}
          <div>
            <label htmlFor="animal-passport-number" className={labelClass}>Numero de passeport europeen</label>
            <input
              id="animal-passport-number"
              type="text"
              value={passportNumber}
              onChange={(e) => setPassportNumber(e.target.value)}
              placeholder="Numero de passeport"
              className={inputClass}
            />
          </div>

          {/* Date d'identification */}
          <div>
            <label htmlFor="animal-identification-date" className={labelClass}>Date d&apos;identification</label>
            <input
              id="animal-identification-date"
              type="date"
              value={identificationDate}
              onChange={(e) => setIdentificationDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Veterinaire identifiant */}
          <div className="md:col-span-2 lg:col-span-2">
            <VeterinarianSelect
              id="animal-identifying-vet"
              value={identifyingVetId}
              onChange={(vetId) => setIdentifyingVetId(vetId)}
              inputClass={inputClass}
              labelClass={labelClass}
              label="Veterinaire identifiant"
            />
          </div>
        </div>
      </div>

      {/* Section: Lieu de capture (creation only) */}
      {!isEditing && (
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

            {/* Circonstances */}
            <div>
              <label htmlFor="animal-capture-circumstances" className={labelClass}>Circonstances</label>
              <textarea
                id="animal-capture-circumstances"
                value={captureCircumstances}
                onChange={(e) => setCaptureCircumstances(e.target.value)}
                placeholder="Circonstances de la capture..."
                rows={3}
                className={`${inputClass} resize-y`}
              />
            </div>
          </div>
        </div>
      )}

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
