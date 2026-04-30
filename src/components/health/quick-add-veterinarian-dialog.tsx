'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { X, Stethoscope, Building2, Plus, Loader2 } from 'lucide-react'
import {
  getVeterinaryClinics,
  createVeterinaryClinic,
  createVeterinarian,
} from '@/lib/actions/veterinarians'
import type { VeterinaryClinicWithVets } from '@/lib/types/database'

interface QuickAddVeterinarianDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (vetId: string, displayName: string) => void
}

export function QuickAddVeterinarianDialog({ open, onClose, onCreated }: Readonly<QuickAddVeterinarianDialogProps>) {
  const [clinics, setClinics] = useState<VeterinaryClinicWithVets[]>([])
  const [mode, setMode] = useState<'existing' | 'new-clinic'>('existing')
  const [clinicId, setClinicId] = useState('')
  const [newClinicName, setNewClinicName] = useState('')
  const [newClinicCity, setNewClinicCity] = useState('')
  const [newClinicPhone, setNewClinicPhone] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    getVeterinaryClinics(true).then((result) => {
      if (result.data) {
        setClinics(result.data)
        if (result.data.length === 0) {
          setMode('new-clinic')
        } else if (!clinicId) {
          const def = result.data.find((c) => c.is_default) || result.data[0]
          setClinicId(def.id)
        }
      }
    })
  }, [open, clinicId])

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!lastName.trim()) {
      toast.error('Le nom du praticien est obligatoire')
      return
    }

    startTransition(async () => {
      let targetClinicId = clinicId

      if (mode === 'new-clinic') {
        if (!newClinicName.trim()) {
          toast.error('Le nom de la clinique est obligatoire')
          return
        }
        const clinicResult = await createVeterinaryClinic({
          name: newClinicName.trim(),
          city: newClinicCity.trim() || undefined,
          phone: newClinicPhone.trim() || undefined,
        })
        if (clinicResult.error || !clinicResult.data) {
          toast.error(clinicResult.error || 'Erreur création clinique')
          return
        }
        targetClinicId = clinicResult.data.id
      }

      if (!targetClinicId) {
        toast.error('Sélectionnez ou créez une clinique')
        return
      }

      const vetResult = await createVeterinarian({
        clinic_id: targetClinicId,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim(),
        specialty: specialty.trim() || undefined,
      })

      if (vetResult.error || !vetResult.data) {
        toast.error(vetResult.error || 'Erreur création praticien')
        return
      }

      const clinicName = mode === 'new-clinic'
        ? newClinicName.trim()
        : (clinics.find((c) => c.id === targetClinicId)?.name || '')
      const display = `${firstName ? `${firstName} ${lastName}` : `Dr ${lastName}`}${clinicName ? ` (${clinicName})` : ''}`

      toast.success('Praticien ajouté')
      onCreated(vetResult.data.id, display)
      // Reset
      setFirstName('')
      setLastName('')
      setSpecialty('')
      setNewClinicName('')
      setNewClinicCity('')
      setNewClinicPhone('')
    })
  }

  const inputClass = 'w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface rounded-xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Ajouter un praticien</h2>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-text" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('existing')}
              disabled={clinics.length === 0}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                mode === 'existing'
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-muted hover:text-text disabled:opacity-50'
              }`}
            >
              <Building2 className="w-3 h-3 inline mr-1" />
              Clinique existante
            </button>
            <button
              type="button"
              onClick={() => setMode('new-clinic')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                mode === 'new-clinic'
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-muted hover:text-text'
              }`}
            >
              <Plus className="w-3 h-3 inline mr-1" />
              Nouvelle clinique
            </button>
          </div>

          {/* Clinic selection or creation */}
          {mode === 'existing' && (
            <div>
              <label htmlFor="qa-clinic" className={labelClass}>Clinique *</label>
              <select
                id="qa-clinic"
                value={clinicId}
                onChange={(e) => setClinicId(e.target.value)}
                required
                className={inputClass}
              >
                <option value="">Sélectionner...</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.city ? ` — ${c.city}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === 'new-clinic' && (
            <div className="space-y-3 pb-3 border-b border-border">
              <div>
                <label htmlFor="qa-new-clinic-name" className={labelClass}>Nom de la clinique *</label>
                <input
                  id="qa-new-clinic-name"
                  value={newClinicName}
                  onChange={(e) => setNewClinicName(e.target.value)}
                  placeholder="Clinique vétérinaire..."
                  required
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="qa-new-clinic-city" className={labelClass}>Ville</label>
                  <input
                    id="qa-new-clinic-city"
                    value={newClinicCity}
                    onChange={(e) => setNewClinicCity(e.target.value)}
                    placeholder="Cambrai"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="qa-new-clinic-phone" className={labelClass}>Téléphone</label>
                  <input
                    id="qa-new-clinic-phone"
                    type="tel"
                    value={newClinicPhone}
                    onChange={(e) => setNewClinicPhone(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Veterinarian */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="qa-first-name" className={labelClass}>Prénom</label>
              <input
                id="qa-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="qa-last-name" className={labelClass}>Nom *</label>
              <input
                id="qa-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="qa-specialty" className={labelClass}>Spécialité</label>
            <input
              id="qa-specialty"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Généraliste, chirurgien, NAC..."
              className={inputClass}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg text-sm border border-border text-muted hover:bg-surface-hover transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
