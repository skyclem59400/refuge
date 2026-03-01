'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Camera, Loader2, User, MapPin, PawPrint } from 'lucide-react'
import { createIntervention } from '@/lib/actions/interventions'
import { CommuneAutocomplete } from '@/components/ui/commune-autocomplete'
import { RecentCalls } from '@/components/pound/recent-calls'
import { getBreedsForSpecies } from '@/lib/breeds'
import type { AnimalSpecies, AnimalSex, AnimalOrigin } from '@/lib/types/database'

const ORIGIN_OPTIONS: { value: AnimalOrigin; label: string }[] = [
  { value: 'found', label: 'Trouve' },
  { value: 'abandoned', label: 'Abandonne' },
  { value: 'divagation', label: 'Divagation' },
  { value: 'surrender', label: 'Cession proprietaire' },
  { value: 'requisition', label: 'Requisition' },
]

export function InterventionForm() {
  // Caller fields
  const [callerName, setCallerName] = useState('')
  const [callerPhone, setCallerPhone] = useState('')
  const [callerEmail, setCallerEmail] = useState('')

  // Location fields
  const [streetNumber, setStreetNumber] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')

  // Animal fields
  const [species, setSpecies] = useState<AnimalSpecies>('dog')
  const [sex, setSex] = useState<AnimalSex>('unknown')
  const [breed, setBreed] = useState('')
  const [originType, setOriginType] = useState<AnimalOrigin>('found')
  const [animalName, setAnimalName] = useState('')
  const [notes, setNotes] = useState('')

  // Photo
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const breeds = getBreedsForSpecies(species)

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez selectionner une image')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas depasser 5 Mo")
      return
    }

    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!callerName.trim()) {
      toast.error('Le nom de l\'appelant est obligatoire')
      return
    }
    if (!street.trim()) {
      toast.error('La rue est obligatoire')
      return
    }
    if (!city.trim()) {
      toast.error('La commune est obligatoire')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('caller_name', callerName.trim())
      if (callerPhone.trim()) formData.set('caller_phone', callerPhone.trim())
      if (callerEmail.trim()) formData.set('caller_email', callerEmail.trim())
      if (streetNumber.trim()) formData.set('location_street_number', streetNumber.trim())
      formData.set('location_street', street.trim())
      formData.set('location_city', city.trim())
      formData.set('species', species)
      formData.set('sex', sex)
      if (breed) formData.set('breed', breed)
      formData.set('origin_type', originType)
      if (animalName.trim()) formData.set('animal_name', animalName.trim())
      if (notes.trim()) formData.set('notes', notes.trim())
      if (photoFile) formData.set('photo', photoFile)

      const result = await createIntervention(formData)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Intervention enregistree')
        router.push('/pound/interventions')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Recent calls from Ringover astreinte line */}
      <RecentCalls onSelect={({ callerName, callerPhone }) => {
        if (callerName) setCallerName(callerName)
        if (callerPhone) setCallerPhone(callerPhone)
      }} />

      {/* Section 1: Appelant */}
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          Appelant
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">
              Nom <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={callerName}
              onChange={(e) => setCallerName(e.target.value)}
              placeholder="Nom de l'appelant"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Telephone</label>
            <input
              type="tel"
              value={callerPhone}
              onChange={(e) => setCallerPhone(e.target.value)}
              placeholder="06 12 34 56 78"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={callerEmail}
              onChange={(e) => setCallerEmail(e.target.value)}
              placeholder="email@exemple.com"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Lieu d'intervention */}
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          Lieu d&apos;intervention
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Numero</label>
            <input
              type="text"
              value={streetNumber}
              onChange={(e) => setStreetNumber(e.target.value)}
              placeholder="12"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">
              Rue <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="Rue de la Paix"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-sm font-medium mb-1">
              Commune <span className="text-error">*</span>
            </label>
            <CommuneAutocomplete
              value={city}
              onChange={setCity}
              placeholder="Rechercher une commune..."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Animal recupere */}
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <PawPrint className="w-4 h-4 text-primary" />
          Animal recupere
        </h3>

        {/* Photo */}
        <div>
          <label className="block text-sm font-medium mb-2">Photo</label>
          <div className="flex items-center gap-4">
            {photoPreview ? (
              <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border">
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoPreview(null)
                    setPhotoFile(null)
                    if (fileRef.current) fileRef.current.value = ''
                  }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80"
                >
                  &times;
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-24 h-24 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted hover:text-primary transition-colors"
              >
                <Camera className="w-6 h-6" />
                <span className="text-xs">Photo</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Species */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Espece <span className="text-error">*</span>
            </label>
            <select
              value={species}
              onChange={(e) => {
                setSpecies(e.target.value as AnimalSpecies)
                setBreed('')
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="dog">Chien</option>
              <option value="cat">Chat</option>
            </select>
          </div>

          {/* Sex */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Sexe <span className="text-error">*</span>
            </label>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value as AnimalSex)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="unknown">Inconnu</option>
              <option value="male">Male</option>
              <option value="female">Femelle</option>
            </select>
          </div>

          {/* Breed */}
          <div>
            <label className="block text-sm font-medium mb-1">Race</label>
            <select
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Inconnue / Croise</option>
              {breeds.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Origin */}
          <div>
            <label className="block text-sm font-medium mb-1">Origine</label>
            <select
              value={originType}
              onChange={(e) => setOriginType(e.target.value as AnimalOrigin)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {ORIGIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Animal name (optional) */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">
              Nom de l&apos;animal <span className="text-muted text-xs">(optionnel)</span>
            </label>
            <input
              type="text"
              value={animalName}
              onChange={(e) => setAnimalName(e.target.value)}
              placeholder="Genere automatiquement si vide"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Notes / Circonstances <span className="text-muted text-xs">(optionnel)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Circonstances de l'intervention, etat de l'animal..."
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Enregistrer l&apos;intervention
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isPending}
          className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-surface-hover transition-colors disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
