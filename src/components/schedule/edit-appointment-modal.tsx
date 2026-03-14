'use client'

import { useState, useTransition } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateAppointment } from '@/lib/actions/appointments'
import type { Appointment, AppointmentStatus } from '@/lib/types/database'

interface EditAppointmentModalProps {
  appointment: Appointment
  animals: { id: string; nom: string }[]
  members: { user_id: string; full_name?: string | null; pseudo: string | null; email?: string }[]
  userNames: Record<string, string>
  onClose: () => void
  onSuccess: () => void
}

export function EditAppointmentModal({
  appointment,
  animals,
  members,
  userNames,
  onClose,
  onSuccess,
}: Readonly<EditAppointmentModalProps>) {
  const [isPending, startTransition] = useTransition()
  const [type, setType] = useState(appointment.type)
  const [customType, setCustomType] = useState(
    !['adoption', 'veterinary'].includes(appointment.type) ? appointment.type : ''
  )
  const [showCustomType, setShowCustomType] = useState(
    !['adoption', 'veterinary'].includes(appointment.type)
  )
  const [animalId, setAnimalId] = useState(appointment.animal_id || '')
  const [assignedUserId, setAssignedUserId] = useState(appointment.assigned_user_id || '')
  const [clientName, setClientName] = useState(appointment.client_name || '')
  const [clientPhone, setClientPhone] = useState(appointment.client_phone || '')
  const [clientEmail, setClientEmail] = useState(appointment.client_email || '')
  const [date, setDate] = useState(appointment.date)
  const [startTime, setStartTime] = useState(appointment.start_time)
  const [endTime, setEndTime] = useState(appointment.end_time)
  const [notes, setNotes] = useState(appointment.notes || '')
  const [status, setStatus] = useState<AppointmentStatus>(appointment.status)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!animalId || !assignedUserId || !date || !startTime || !endTime) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }

    if (type === 'adoption' && !clientName.trim()) {
      toast.error('Le nom du client est obligatoire pour les adoptions')
      return
    }

    startTransition(async () => {
      const result = await updateAppointment(appointment.id, {
        type: showCustomType ? customType : type,
        animal_id: animalId || null,
        assigned_user_id: assignedUserId || null,
        client_name: clientName.trim() || undefined,
        client_phone: clientPhone.trim() || undefined,
        client_email: clientEmail.trim() || undefined,
        date,
        start_time: startTime,
        end_time: endTime,
        notes: notes.trim() || undefined,
        status,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Rendez-vous mis à jour avec succès')
        onSuccess()
        onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface rounded-xl border border-border p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Modifier le rendez-vous</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type */}
          <div>
            <label id="appointment-type-label" className="block text-sm font-medium mb-2">
              Type de rendez-vous <span className="text-error">*</span>
            </label>
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
                id="appointment-type"
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Animal */}
            <div>
              <label htmlFor="animal" className="block text-sm font-medium mb-2">
                Animal <span className="text-error">*</span>
              </label>
              <select
                id="animal"
                value={animalId}
                onChange={(e) => setAnimalId(e.target.value)}
                required
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Sélectionner un animal</option>
                {animals.map((animal) => (
                  <option key={animal.id} value={animal.id}>
                    {animal.nom}
                  </option>
                ))}
              </select>
            </div>

            {/* Assigned user */}
            <div>
              <label htmlFor="assignedUser" className="block text-sm font-medium mb-2">
                Collaborateur assigné <span className="text-error">*</span>
              </label>
              <select
                id="assignedUser"
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                required
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Sélectionner un collaborateur</option>
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
                <div>
                  <label htmlFor="clientName" className="block text-sm font-medium mb-2">
                    Nom du client <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    id="clientName"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label htmlFor="clientPhone" className="block text-sm font-medium mb-2">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    id="clientPhone"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label htmlFor="clientEmail" className="block text-sm font-medium mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="clientEmail"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </>
            )}

            {/* Date */}
            <div>
              <label htmlFor="date" className="block text-sm font-medium mb-2">
                Date <span className="text-error">*</span>
              </label>
              <input
                type="date"
                id="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Start time */}
            <div>
              <label htmlFor="startTime" className="block text-sm font-medium mb-2">
                Heure de début <span className="text-error">*</span>
              </label>
              <input
                type="time"
                id="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* End time */}
            <div>
              <label htmlFor="endTime" className="block text-sm font-medium mb-2">
                Heure de fin <span className="text-error">*</span>
              </label>
              <input
                type="time"
                id="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
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
              rows={3}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border hover:bg-surface-hover transition-colors text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
