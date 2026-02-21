'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createAnimal, updateAnimal } from '@/lib/actions/animals'
import type { Animal, Box, AnimalSpecies, AnimalSex, AnimalOrigin } from '@/lib/types/database'

interface AnimalFormProps {
  animal?: Animal
  boxes?: Box[]
}

export function AnimalForm({ animal, boxes = [] }: AnimalFormProps) {
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

  // Identification fields
  const [chipNumber, setChipNumber] = useState(animal?.chip_number || '')
  const [tattooNumber, setTattooNumber] = useState(animal?.tattoo_number || '')
  const [tattooPosition, setTattooPosition] = useState(animal?.tattoo_position || '')
  const [medalNumber, setMedalNumber] = useState(animal?.medal_number || '')
  const [loofNumber, setLoofNumber] = useState(animal?.loof_number || '')
  const [passportNumber, setPassportNumber] = useState(animal?.passport_number || '')

  // Capture fields (only for creation)
  const [captureLocation, setCaptureLocation] = useState(animal?.capture_location || '')
  const [captureCircumstances, setCaptureCircumstances] = useState(animal?.capture_circumstances || '')

  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
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
        chip_number: chipNumber || null,
        tattoo_number: tattooNumber || null,
        tattoo_position: tattooPosition || null,
        medal_number: medalNumber || null,
        loof_number: loofNumber || null,
        passport_number: passportNumber || null,
        capture_location: captureLocation || null,
        capture_circumstances: captureCircumstances || null,
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
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
      {/* Section: Identite */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">Identite</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Nom */}
          <div>
            <label className={labelClass}>Nom *</label>
            <input
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
            <label className={labelClass}>Espece *</label>
            <select
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
            <label className={labelClass}>Sexe *</label>
            <select
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
            <label className={labelClass}>Origine *</label>
            <select
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
            <label className={labelClass}>Race</label>
            <input
              type="text"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              placeholder="Race"
              className={inputClass}
            />
          </div>

          {/* Croisement */}
          <div>
            <label className={labelClass}>Croisement</label>
            <input
              type="text"
              value={breedCross}
              onChange={(e) => setBreedCross(e.target.value)}
              placeholder="Croise avec..."
              className={inputClass}
            />
          </div>

          {/* Date de naissance */}
          <div>
            <label className={labelClass}>Date de naissance</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Lieu de naissance */}
          <div>
            <label className={labelClass}>Lieu de naissance</label>
            <input
              type="text"
              value={birthPlace}
              onChange={(e) => setBirthPlace(e.target.value)}
              placeholder="Lieu de naissance"
              className={inputClass}
            />
          </div>

          {/* Couleur */}
          <div>
            <label className={labelClass}>Couleur / Robe</label>
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Couleur du pelage"
              className={inputClass}
            />
          </div>

          {/* Poids */}
          <div>
            <label className={labelClass}>Poids (kg)</label>
            <input
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
            <label className={labelClass}>Score comportemental</label>
            <select
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
            <label className={labelClass}>Box</label>
            <select
              value={boxId}
              onChange={(e) => setBoxId(e.target.value)}
              className={inputClass}
            >
              <option value="">Aucun box</option>
              {boxes.map((box) => (
                <option key={box.id} value={box.id}>
                  {box.name} ({box.species_type === 'cat' ? 'Chats' : box.species_type === 'dog' ? 'Chiens' : 'Mixte'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description - full width */}
        <div className="mt-4">
          <label className={labelClass}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description de l'animal, particularites..."
            rows={3}
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
            <label className={labelClass}>Numero de puce</label>
            <input
              type="text"
              value={chipNumber}
              onChange={(e) => setChipNumber(e.target.value)}
              placeholder="250..."
              className={inputClass}
            />
          </div>

          {/* Numero de tatouage */}
          <div>
            <label className={labelClass}>Numero de tatouage</label>
            <input
              type="text"
              value={tattooNumber}
              onChange={(e) => setTattooNumber(e.target.value)}
              placeholder="Numero de tatouage"
              className={inputClass}
            />
          </div>

          {/* Position tatouage */}
          <div>
            <label className={labelClass}>Position du tatouage</label>
            <input
              type="text"
              value={tattooPosition}
              onChange={(e) => setTattooPosition(e.target.value)}
              placeholder="Oreille droite, cuisse..."
              className={inputClass}
            />
          </div>

          {/* Numero de medaille */}
          <div>
            <label className={labelClass}>Numero de medaille</label>
            <input
              type="text"
              value={medalNumber}
              onChange={(e) => setMedalNumber(e.target.value)}
              placeholder="Numero de medaille"
              className={inputClass}
            />
          </div>

          {/* Numero LOOF */}
          <div>
            <label className={labelClass}>Numero LOOF</label>
            <input
              type="text"
              value={loofNumber}
              onChange={(e) => setLoofNumber(e.target.value)}
              placeholder="Numero LOOF"
              className={inputClass}
            />
          </div>

          {/* Numero de passeport */}
          <div>
            <label className={labelClass}>Numero de passeport</label>
            <input
              type="text"
              value={passportNumber}
              onChange={(e) => setPassportNumber(e.target.value)}
              placeholder="Numero de passeport"
              className={inputClass}
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
              <label className={labelClass}>Lieu de capture</label>
              <input
                type="text"
                value={captureLocation}
                onChange={(e) => setCaptureLocation(e.target.value)}
                placeholder="Adresse ou lieu de capture"
                className={inputClass}
              />
            </div>

            {/* Circonstances */}
            <div>
              <label className={labelClass}>Circonstances</label>
              <textarea
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
          {isPending
            ? 'Enregistrement...'
            : isEditing
              ? 'Mettre a jour'
              : 'Enregistrer l\'animal'}
        </button>
      </div>
    </form>
  )
}
