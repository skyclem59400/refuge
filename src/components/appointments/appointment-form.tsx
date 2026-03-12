'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Clock, User, Phone, Mail, PawPrint, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { createAppointment } from '@/lib/actions/appointments'
import type { AppointmentType, AppointmentStatus } from '@/lib/types/database'

interface AppointmentFormProps {
  animals?: { id: string; nom: string }[]
  members?: { user_id: string; full_name?: string | null; pseudo: string | null; email?: string }[]
  userNames?: Record<string, string>
  onClose?: () => void
}

export function AppointmentForm({ animals = [], members = [], userNames = {}, onClose }: Readonly<AppointmentFormProps>) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [type, setType] = useState<AppointmentType>('adoption')
  const [customType, setCustomType] = useState('')
  const [showCustomType, setShowCustomType] = useState(false)
  const [animalId, setAnimalId] = useState<string>('')
  const [assignedUserId, setAssignedUserId] = useState<string>('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('11:00')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<AppointmentStatus>('scheduled')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const isCustomType = showCustomType
    // For standard types: animal, collaborateur, date, heures are required
    // For custom types ("Autre"): nothing is required except type name
    if (!isCustomType) {
      if (!animalId || !assignedUserId || !date || !startTime || !endTime) {
        toast.error('Veuillez remplir tous les champs obligatoires')
        return
      }
    } else {
      if (!customType.trim()) {
        toast.error('Veuillez indiquer le type de rendez-vous')
        return
      }
    }

    // For adoption appointments, client name is required
    if (type === 'adoption' && !clientName.trim()) {
      toast.error('Le nom du client est obligatoire pour les adoptions')
      return
    }

    startTransition(async () => {
      const result = await createAppointment({
        type,
        animal_id: animalId || null,
        assigned_user_id: assignedUserId || null,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim() || null,
        client_email: clientEmail.trim() || null,
        date,
        start_time: startTime,
        end_time: endTime,
        notes: notes.trim() || null,
        status,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Rendez-vous cree avec succes')
        // Reset form
        setType('adoption')
        setCustomType('')
        setShowCustomType(false)
        setAnimalId('')
        setAssignedUserId('')
        setClientName('')
        setClientPhone('')
        setClientEmail('')
        setDate('')
        setStartTime('10:00')
        setEndTime('11:00')
        setNotes('')
        setStatus('scheduled')
        router.refresh()
        onClose?.()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          Nouveau rendez-vous
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Type */}
        <div className="md:col-span-2">
          <span id="appointment-type-label" className="block text-sm font-medium mb-2">
            Type de rendez-vous <span className="text-error">*</span>
          </span>
          <div className="flex flex-wrap gap-2 mb-2" role="group" aria-labelledby="appointment-type-label">
            <button
              type="button"
              onClick={() => {
                setType('adoption')
                setShowCustomType(false)
              }}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                type === 'adoption' && !showCustomType
                  ? 'bg-green-500/10 border-green-500/30 text-green-700'
                  : 'bg-surface-hover border-border text-muted hover:border-border/50'
              }`}
            >
              Adoption
            </button>
            <button
              type="button"
              onClick={() => {
                setType('veterinary')
                setShowCustomType(false)
              }}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                type === 'veterinary' && !showCustomType
                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-700'
                  : 'bg-surface-hover border-border text-muted hover:border-border/50'
              }`}
            >
              Vétérinaire
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCustomType(true)
                setType(customType || '')
              }}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                showCustomType
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-surface-hover border-border text-muted hover:border-border/50'
              }`}
            >
              Autre
            </button>
          </div>
          {showCustomType && (
            <input
              type="text"
              value={customType}
              onChange={(e) => {
                setCustomType(e.target.value)
                setType(e.target.value)
              }}
              placeholder="Type de rendez-vous personnalisé..."
              required
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          )}
        </div>

        {/* Animal */}
        <div>
          <label htmlFor="animal" className="block text-sm font-medium mb-2">
            <PawPrint className="w-3.5 h-3.5 inline mr-1" />
            Animal {!showCustomType && <span className="text-error">*</span>}
          </label>
          <select
            id="animal"
            value={animalId}
            onChange={(e) => setAnimalId(e.target.value)}
            required={!showCustomType}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">
              {animals.length === 0 ? 'Aucun animal disponible' : 'Sélectionner un animal'}
            </option>
            {animals.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animal.nom}
              </option>
            ))}
          </select>
        </div>

        {/* Assigned staff member */}
        <div>
          <label htmlFor="assignedUser" className="block text-sm font-medium mb-2">
            <User className="w-3.5 h-3.5 inline mr-1" />
            Collaborateur assigné {!showCustomType && <span className="text-error">*</span>}
          </label>
          <select
            id="assignedUser"
            value={assignedUserId}
            onChange={(e) => setAssignedUserId(e.target.value)}
            required={!showCustomType}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">
              {members.length === 0 ? 'Aucun collaborateur disponible' : 'Sélectionner un collaborateur'}
            </option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {userNames[member.user_id] || member.full_name || member.pseudo || member.email}
              </option>
            ))}
          </select>
        </div>

        {/* Client fields - only for adoption */}
        {type === 'adoption' && (
          <>
            {/* Client name */}
            <div>
              <label htmlFor="clientName" className="block text-sm font-medium mb-2">
                <User className="w-3.5 h-3.5 inline mr-1" />
                Nom du client <span className="text-error">*</span>
              </label>
              <input
                type="text"
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Jean Dupont"
                required
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Client phone */}
            <div>
              <label htmlFor="clientPhone" className="block text-sm font-medium mb-2">
                <Phone className="w-3.5 h-3.5 inline mr-1" />
                Téléphone
              </label>
              <input
                type="tel"
                id="clientPhone"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="06 12 34 56 78"
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Client email */}
            <div>
              <label htmlFor="clientEmail" className="block text-sm font-medium mb-2">
                <Mail className="w-3.5 h-3.5 inline mr-1" />
                Email
              </label>
              <input
                type="email"
                id="clientEmail"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="jean.dupont@email.com"
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </>
        )}

        {/* Date */}
        <div>
          <label htmlFor="date" className="block text-sm font-medium mb-2">
            <CalendarDays className="w-3.5 h-3.5 inline mr-1" />
            Date {!showCustomType && <span className="text-error">*</span>}
          </label>
          <input
            type="date"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required={!showCustomType}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Start time */}
        <div>
          <label htmlFor="startTime" className="block text-sm font-medium mb-2">
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            Heure de début {!showCustomType && <span className="text-error">*</span>}
          </label>
          <input
            type="time"
            id="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required={!showCustomType}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* End time */}
        <div>
          <label htmlFor="endTime" className="block text-sm font-medium mb-2">
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            Heure de fin {!showCustomType && <span className="text-error">*</span>}
          </label>
          <input
            type="time"
            id="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required={!showCustomType}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Status */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium mb-2">
            Statut
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="scheduled">Planifié</option>
            <option value="confirmed">Confirmé</option>
            <option value="completed">Terminé</option>
            <option value="cancelled">Annulé</option>
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium mb-2">
          Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Informations complémentaires..."
          rows={3}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Submit button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isPending ? 'Création...' : 'Créer le rendez-vous'}
        </button>
      </div>
    </form>
  )
}
