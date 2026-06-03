'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Users,
  Heart,
  Stethoscope,
  Calendar,
  Loader2,
  PawPrint,
  User,
  Phone,
  Mail,
} from 'lucide-react'
import { createSchedule } from '@/lib/actions/schedule'
import { createAppointment } from '@/lib/actions/appointments'
import { DatePicker } from '@/components/ui/date-picker'

type EventCategory = 'presence' | 'adoption' | 'veterinary' | 'other'
type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled'

interface Member {
  user_id: string
  full_name?: string | null
  pseudo: string | null
  email?: string
}

interface EventCreatorProps {
  members: Member[]
  userNames: Record<string, string>
  animals?: { id: string; nom: string }[]
  onCreated?: () => void
}

const CATEGORIES: Array<{
  id: EventCategory
  label: string
  description: string
  Icon: React.ComponentType<{ className?: string }>
  colorActive: string
  colorIdle: string
}> = [
  {
    id: 'presence',
    label: 'Présence',
    description: 'Un collaborateur est planifié',
    Icon: Users,
    colorActive: 'bg-blue-500/15 border-blue-500/50 text-blue-500',
    colorIdle: 'bg-surface border-border text-muted hover:border-blue-500/30 hover:text-blue-500',
  },
  {
    id: 'adoption',
    label: 'RDV adoption',
    description: 'Visite famille pour un animal',
    Icon: Heart,
    colorActive: 'bg-success/15 border-success/50 text-success',
    colorIdle: 'bg-surface border-border text-muted hover:border-success/30 hover:text-success',
  },
  {
    id: 'veterinary',
    label: 'RDV vétérinaire',
    description: 'Visite véto pour un animal',
    Icon: Stethoscope,
    colorActive: 'bg-orange-500/15 border-orange-500/50 text-orange-500',
    colorIdle: 'bg-surface border-border text-muted hover:border-orange-500/30 hover:text-orange-500',
  },
  {
    id: 'other',
    label: 'Autre',
    description: 'Réunion, formation, externe...',
    Icon: Calendar,
    colorActive: 'bg-accent/15 border-accent/50 text-accent',
    colorIdle: 'bg-surface border-border text-muted hover:border-accent/30 hover:text-accent',
  },
]

const STATUS_OPTIONS: Array<{ value: AppointmentStatus; label: string }> = [
  { value: 'scheduled', label: 'Planifié' },
  { value: 'confirmed', label: 'Confirmé' },
  { value: 'completed', label: 'Terminé' },
  { value: 'cancelled', label: 'Annulé' },
]

export function EventCreator({ members, userNames, animals = [], onCreated }: Readonly<EventCreatorProps>) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [category, setCategory] = useState<EventCategory>('presence')

  // Champs communs
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [notes, setNotes] = useState('')

  // Présence
  const [userId, setUserId] = useState('')

  // Appointment communs
  const [animalId, setAnimalId] = useState('')
  const [assignedUserId, setAssignedUserId] = useState('')
  const [status, setStatus] = useState<AppointmentStatus>('scheduled')

  // Adoption
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')

  // Other
  const [customType, setCustomType] = useState('')

  function resetAll() {
    setDate('')
    setStartTime(category === 'presence' ? '09:00' : '10:00')
    setEndTime(category === 'presence' ? '17:00' : '11:00')
    setNotes('')
    setUserId('')
    setAnimalId('')
    setAssignedUserId('')
    setStatus('scheduled')
    setClientName('')
    setClientPhone('')
    setClientEmail('')
    setCustomType('')
  }

  function handleCategoryChange(next: EventCategory) {
    setCategory(next)
    // Ajuste les horaires par défaut selon le type (présence = journée, RDV = 1h)
    if (next === 'presence') {
      setStartTime('09:00')
      setEndTime('17:00')
    } else {
      setStartTime('10:00')
      setEndTime('11:00')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validations communes
    if (!date || !startTime || !endTime) {
      toast.error('Date et horaires sont obligatoires.')
      return
    }
    if (endTime <= startTime) {
      toast.error("L'heure de fin doit être après l'heure de début.")
      return
    }

    startTransition(async () => {
      if (category === 'presence') {
        if (!userId) {
          toast.error('Sélectionne un collaborateur.')
          return
        }
        const result = await createSchedule({
          user_id: userId,
          date,
          start_time: startTime,
          end_time: endTime,
          notes: notes.trim() || null,
        })
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success('Présence ajoutée à l\'agenda')
          resetAll()
          router.refresh()
          onCreated?.()
        }
        return
      }

      // Appointment (adoption / veterinary / other)
      const apptType =
        category === 'adoption' ? 'adoption' : category === 'veterinary' ? 'veterinary' : customType.trim()

      if (category === 'other' && !customType.trim()) {
        toast.error('Précise le type d\'événement (ex: "Réunion équipe").')
        return
      }
      if (category !== 'other' && (!animalId || !assignedUserId)) {
        toast.error('Animal et collaborateur assigné sont obligatoires.')
        return
      }
      if (category === 'adoption' && !clientName.trim()) {
        toast.error('Nom du client obligatoire pour les RDV adoption.')
        return
      }

      const result = await createAppointment({
        type: apptType,
        animal_id: animalId || null,
        assigned_user_id: assignedUserId || null,
        client_name: clientName.trim() || (category === 'other' ? customType.trim() : ''),
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
        toast.success('Événement ajouté à l\'agenda')
        resetAll()
        router.refresh()
        onCreated?.()
      }
    })
  }

  const inputBase =
    'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30'
  const labelClass = 'block text-xs font-medium text-muted mb-1'

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-semibold text-text">Ajouter à l&apos;agenda</h3>
      </div>

      {/* Sélecteur de type en cartes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {CATEGORIES.map((c) => {
          const isActive = category === c.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => handleCategoryChange(c.id)}
              className={`text-left px-3 py-3 rounded-lg border-2 transition-all ${
                isActive ? c.colorActive : c.colorIdle
              }`}
            >
              <c.Icon className="w-5 h-5 mb-2" />
              <div className="text-sm font-semibold">{c.label}</div>
              <div className="text-[11px] opacity-70 leading-tight mt-0.5">{c.description}</div>
            </button>
          )
        })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Champs PRÉSENCE */}
        {category === 'presence' && (
          <div>
            <label htmlFor="ec-user" className={labelClass}>Collaborateur *</label>
            <select
              id="ec-user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className={inputBase}
              required
            >
              <option value="">Sélectionner un collaborateur</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {userNames[m.user_id] || m.full_name || m.pseudo || m.email}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Champs APPOINTMENT (sauf "autre" sans animal/staff requis) */}
        {category !== 'presence' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {category === 'other' && (
              <div className="md:col-span-2">
                <label htmlFor="ec-customtype" className={labelClass}>Type d&apos;événement *</label>
                <input
                  id="ec-customtype"
                  type="text"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="Ex: Réunion équipe, Formation, Visite externe..."
                  className={inputBase}
                  required
                />
              </div>
            )}

            {category !== 'other' && (
              <div>
                <label htmlFor="ec-animal" className={labelClass}>
                  <PawPrint className="w-3 h-3 inline mr-1" /> Animal *
                </label>
                <select
                  id="ec-animal"
                  value={animalId}
                  onChange={(e) => setAnimalId(e.target.value)}
                  className={inputBase}
                  required
                >
                  <option value="">
                    {animals.length === 0 ? 'Aucun animal disponible' : 'Sélectionner un animal'}
                  </option>
                  {animals.map((a) => (
                    <option key={a.id} value={a.id}>{a.nom}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="ec-assigned" className={labelClass}>
                <User className="w-3 h-3 inline mr-1" />
                Collaborateur assigné {category !== 'other' && '*'}
              </label>
              <select
                id="ec-assigned"
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className={inputBase}
                required={category !== 'other'}
              >
                <option value="">Sélectionner</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {userNames[m.user_id] || m.full_name || m.pseudo || m.email}
                  </option>
                ))}
              </select>
            </div>

            {category === 'adoption' && (
              <>
                <div className="md:col-span-2">
                  <label htmlFor="ec-clientname" className={labelClass}>Nom du client / famille *</label>
                  <input
                    id="ec-clientname"
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Famille Dupont"
                    className={inputBase}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="ec-clientphone" className={labelClass}>
                    <Phone className="w-3 h-3 inline mr-1" /> Téléphone
                  </label>
                  <input
                    id="ec-clientphone"
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="06 12 34 56 78"
                    className={inputBase}
                  />
                </div>
                <div>
                  <label htmlFor="ec-clientemail" className={labelClass}>
                    <Mail className="w-3 h-3 inline mr-1" /> Email
                  </label>
                  <input
                    id="ec-clientemail"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="famille@email.com"
                    className={inputBase}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Date + heures (commun) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label htmlFor="ec-date" className={labelClass}>Date *</label>
            <DatePicker id="ec-date" value={date} onChange={(v) => setDate(v ?? '')} required />
          </div>
          <div>
            <label htmlFor="ec-start" className={labelClass}>Heure début *</label>
            <input
              id="ec-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={inputBase}
              required
            />
          </div>
          <div>
            <label htmlFor="ec-end" className={labelClass}>Heure fin *</label>
            <input
              id="ec-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={inputBase}
              required
            />
          </div>
        </div>

        {/* Statut (pour les appointments) */}
        {category !== 'presence' && (
          <div>
            <label htmlFor="ec-status" className={labelClass}>Statut</label>
            <select
              id="ec-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
              className={inputBase}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Notes (commun) */}
        <div>
          <label htmlFor="ec-notes" className={labelClass}>Notes</label>
          <textarea
            id="ec-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Informations complémentaires…"
            rows={2}
            className={`${inputBase} resize-y`}
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Création...</>
          ) : (
            <>+ Ajouter à l&apos;agenda</>
          )}
        </button>
      </form>
    </div>
  )
}
