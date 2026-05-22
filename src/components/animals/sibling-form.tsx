'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Users, Sparkles } from 'lucide-react'
import { createAnimalSiblings, type SiblingPerAnimalData } from '@/lib/actions/animal-siblings'
import { SPECIES_LABELS, ALL_SPECIES } from '@/lib/species'
import { DatePicker } from '@/components/ui/date-picker'
import type { AnimalSpecies, AnimalSex, AnimalOrigin, AnimalStatus, Box } from '@/lib/types/database'

interface Props {
  readonly boxes: Box[]
}

const ORIGIN_OPTIONS: { value: AnimalOrigin; label: string }[] = [
  { value: 'found', label: 'Trouvé / errant' },
  { value: 'abandoned', label: 'Abandonné' },
  { value: 'surrender', label: 'Abandon volontaire' },
  { value: 'requisition', label: 'Réquisition judiciaire' },
  { value: 'transferred_in', label: 'Transfert depuis autre refuge' },
  { value: 'divagation', label: 'Divagation' },
]

const STATUS_OPTIONS: { value: AnimalStatus; label: string }[] = [
  { value: 'pound', label: 'Fourrière' },
  { value: 'shelter', label: 'Refuge' },
]

const SEX_OPTIONS: { value: AnimalSex; label: string }[] = [
  { value: 'female', label: 'Femelle' },
  { value: 'male', label: 'Mâle' },
  { value: 'unknown', label: 'Inconnu' },
]

function emptySibling(): SiblingPerAnimalData {
  return { name: '', sex: 'unknown', color: '', chip_number: '', tattoo_number: '' }
}

export function SiblingForm({ boxes }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Commun
  const [species, setSpecies] = useState<AnimalSpecies>('dog')
  const [breed, setBreed] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [originType, setOriginType] = useState<AnimalOrigin>('found')
  const [status, setStatus] = useState<AnimalStatus>('pound')
  const [boxId, setBoxId] = useState('')
  const [captureLocation, setCaptureLocation] = useState('')
  const [captureCircumstances, setCaptureCircumstances] = useState('')

  // Per-animal (au moins 2 pour démarrer en fratrie)
  const [siblings, setSiblings] = useState<SiblingPerAnimalData[]>([emptySibling(), emptySibling()])

  function addSibling() {
    if (siblings.length >= 20) {
      toast.error('Maximum 20 animaux par fratrie')
      return
    }
    setSiblings((prev) => [...prev, emptySibling()])
  }

  function removeSibling(i: number) {
    if (siblings.length <= 1) return
    setSiblings((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateSibling(i: number, patch: Partial<SiblingPerAnimalData>) {
    setSiblings((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (siblings.length < 1) return toast.error('Au moins un animal requis')
    for (let i = 0; i < siblings.length; i++) {
      if (!siblings[i].name.trim()) {
        return toast.error(`L'animal #${i + 1} n'a pas de nom`)
      }
    }

    startTransition(async () => {
      const res = await createAnimalSiblings({
        common: {
          species,
          breed: breed.trim() || null,
          birth_date: birthDate || null,
          origin_type: originType,
          status,
          box_id: boxId || null,
          capture_location: captureLocation.trim() || null,
          capture_circumstances: captureCircumstances.trim() || null,
          judicial_procedure: originType === 'requisition',
        },
        animals: siblings,
      })

      if (res.error) {
        toast.error(res.error)
        return
      }

      const data = res.data!
      if (data.failed.length === 0) {
        toast.success(`${data.created.length} animaux créés en fratrie`)
      } else {
        toast.warning(
          `${data.created.length} créés, ${data.failed.length} échec(s)`,
        )
        for (const f of data.failed) {
          toast.error(`${f.name} : ${f.error}`)
        }
      }

      // Si tout est OK, rediriger vers la liste pour qu'elle voie ses créations
      if (data.failed.length === 0) {
        router.push('/animals')
        router.refresh()
      }
    })
  }

  const inputClass =
    'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-colors'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* === SECTION 1 : Communes à toute la fratrie === */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-primary-light">
            Infos communes à la fratrie
          </h2>
          <p className="text-xs text-muted ml-2">
            Tout ce qui est saisi ici sera dupliqué sur chaque animal.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Espèce *</label>
            <select
              value={species}
              onChange={(e) => setSpecies(e.target.value as AnimalSpecies)}
              className={inputClass}
            >
              {ALL_SPECIES.map((s) => (
                <option key={s} value={s}>{SPECIES_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Race / croisement (optionnel)</label>
            <input
              type="text"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              placeholder="Ex: Berger croisé"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Date de naissance approximative</label>
            <DatePicker value={birthDate} onChange={(v) => setBirthDate(v ?? '')} />
          </div>

          <div>
            <label className={labelClass}>Origine *</label>
            <select
              value={originType}
              onChange={(e) => setOriginType(e.target.value as AnimalOrigin)}
              className={inputClass}
            >
              {ORIGIN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Statut d&apos;arrivée *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AnimalStatus)}
              className={inputClass}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Box commun (optionnel)</label>
            <select
              value={boxId}
              onChange={(e) => setBoxId(e.target.value)}
              className={inputClass}
            >
              <option value="">— Pas de box assigné —</option>
              {boxes.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Lieu de récupération</label>
            <input
              type="text"
              value={captureLocation}
              onChange={(e) => setCaptureLocation(e.target.value)}
              placeholder="Adresse, ville…"
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Circonstances</label>
            <textarea
              value={captureCircumstances}
              onChange={(e) => setCaptureCircumstances(e.target.value)}
              rows={2}
              placeholder="Description du contexte : saisie, abandon dans la rue, portée trouvée dans un carton…"
              className={`${inputClass} resize-y`}
            />
          </div>
        </div>
      </div>

      {/* === SECTION 2 : Liste des animaux === */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-primary-light">
              Animaux de la fratrie ({siblings.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={addSibling}
            disabled={siblings.length >= 20}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter un animal
          </button>
        </div>

        <div className="space-y-3">
          {siblings.map((s, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface-dark/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted">Animal #{i + 1}</span>
                {siblings.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSibling(i)}
                    className="p-1.5 rounded text-danger border border-danger/30 hover:bg-danger/10 transition-colors"
                    title="Retirer cet animal"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Nom *</label>
                  <input
                    type="text"
                    value={s.name}
                    onChange={(e) => updateSibling(i, { name: e.target.value })}
                    placeholder="Ex: Pixel"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Sexe</label>
                  <select
                    value={s.sex}
                    onChange={(e) => updateSibling(i, { sex: e.target.value as AnimalSex })}
                    className={inputClass}
                  >
                    {SEX_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Couleur / robe</label>
                  <input
                    type="text"
                    value={s.color || ''}
                    onChange={(e) => updateSibling(i, { color: e.target.value })}
                    placeholder="Ex: Noir et blanc"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>N° puce</label>
                  <input
                    type="text"
                    value={s.chip_number || ''}
                    onChange={(e) => updateSibling(i, { chip_number: e.target.value })}
                    placeholder="15 chiffres"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>N° tatouage</label>
                  <input
                    type="text"
                    value={s.tattoo_number || ''}
                    onChange={(e) => updateSibling(i, { tattoo_number: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Poids (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={s.weight ?? ''}
                    onChange={(e) =>
                      updateSibling(i, {
                        weight: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/animals/nouveau')}
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm text-muted border border-border hover:bg-surface-dark transition-colors disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
        >
          <Users className="w-4 h-4" />
          {isPending ? 'Création en cours…' : `Créer la fratrie (${siblings.length})`}
        </button>
      </div>
    </form>
  )
}
