'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Heart,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import {
  validateAdoptionInquiry,
  refuseAdoptionInquiry,
  setInquiryStatus,
  type AdoptionInquiryRow as InquiryRowType,
} from '@/lib/actions/adoption-inquiries'

interface Props {
  inquiry: InquiryRowType
}

const SPECIES_LABEL: Record<string, string> = {
  dog: 'Chien',
  cat: 'Chat',
  rabbit: 'Lapin',
  rodent: 'Rongeur',
  bird: 'Oiseau',
  reptile: 'Reptile',
  cattle: 'Bovin',
  horse: 'Cheval',
  poultry: 'Volaille',
  goat: 'Caprin',
  sheep: 'Ovin',
  pig: 'Porcin',
  other: 'Autre',
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'À traiter', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  contacted: { label: 'Contacté', cls: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  rdv_confirmed: { label: 'RDV confirmé', cls: 'bg-teal-500/10 text-teal-600 border-teal-500/30' },
  rdv_completed: { label: 'RDV honoré', cls: 'bg-green-500/10 text-green-600 border-green-500/30' },
  accepted: { label: 'Adopté', cls: 'bg-green-500/15 text-green-700 border-green-500/40' },
  refused: { label: 'Refusé', cls: 'bg-red-500/10 text-red-600 border-red-500/30' },
  cancelled: { label: 'Annulé', cls: 'bg-gray-500/10 text-gray-600 border-gray-500/30' },
}

export function InquiryRow({ inquiry }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [refusing, setRefusing] = useState(false)
  const [refusalReason, setRefusalReason] = useState('')
  const [teamMessage, setTeamMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const badge = STATUS_BADGE[inquiry.status] ?? STATUS_BADGE.pending
  const dateFr = inquiry.appointment
    ? new Date(inquiry.appointment.date + 'T00:00:00').toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  function doValidate() {
    setError(null)
    startTransition(async () => {
      const res = await validateAdoptionInquiry(inquiry.id, teamMessage || undefined)
      if (res.error) setError(res.error)
    })
  }

  function doRefuse() {
    setError(null)
    if (refusalReason.trim().length < 10) {
      setError('Motif trop court (10 caractères min).')
      return
    }
    startTransition(async () => {
      const res = await refuseAdoptionInquiry(inquiry.id, refusalReason)
      if (res.error) setError(res.error)
      else setRefusing(false)
    })
  }

  function markRdvCompleted() {
    startTransition(async () => {
      const res = await setInquiryStatus(inquiry.id, 'rdv_completed')
      if (res.error) setError(res.error)
    })
  }

  function markAccepted() {
    startTransition(async () => {
      const res = await setInquiryStatus(inquiry.id, 'accepted')
      if (res.error) setError(res.error)
    })
  }

  const questionnaire = inquiry.questionnaire as Record<string, unknown>
  const foyer = questionnaire.foyer as Record<string, string | number> | undefined

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden hover:border-primary/30 transition">
      {/* Bandeau résumé */}
      <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Animal */}
        <div className="flex items-center gap-3 sm:w-64 shrink-0">
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-surface-hover shrink-0 relative">
            {inquiry.animal?.photo_url ? (
              <Image
                src={inquiry.animal.photo_url}
                alt={inquiry.animal.name}
                fill
                sizes="56px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted">
                <Heart size={20} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <Link
              href={`/animals/${inquiry.animal_id}`}
              className="font-semibold text-text hover:text-primary truncate block"
            >
              {inquiry.animal?.name ?? 'Animal supprimé'}
            </Link>
            <div className="text-xs text-muted">
              {inquiry.animal ? SPECIES_LABEL[inquiry.animal.species] ?? inquiry.animal.species : ''}
            </div>
          </div>
        </div>

        {/* Demandeur */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-text">
            {inquiry.first_name} {inquiry.last_name}
          </div>
          <div className="text-xs text-muted flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
            <span className="flex items-center gap-1">
              <Mail size={11} /> {inquiry.email}
            </span>
            <span className="flex items-center gap-1">
              <Phone size={11} /> {inquiry.phone}
            </span>
            {(inquiry.postal_code || inquiry.city) && (
              <span className="flex items-center gap-1">
                <MapPin size={11} /> {inquiry.postal_code} {inquiry.city}
              </span>
            )}
          </div>
        </div>

        {/* RDV */}
        <div className="text-sm sm:text-right shrink-0 sm:w-40">
          {dateFr && inquiry.appointment ? (
            <>
              <div className="font-medium text-text flex items-center sm:justify-end gap-1.5">
                <Calendar size={13} className="text-primary" />
                {dateFr}
              </div>
              <div className="text-xs text-muted">{inquiry.appointment.start_time.slice(0, 5)}</div>
            </>
          ) : (
            <div className="text-xs text-muted italic">RDV non défini</div>
          )}
        </div>

        {/* Statut */}
        <div className="shrink-0">
          <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded border ${badge.cls}`}>
            {badge.label}
          </span>
        </div>

        {/* Expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded hover:bg-surface-hover text-muted shrink-0"
          aria-label={expanded ? 'Replier' : 'Déplier'}
        >
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Détails déplié */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-4 bg-surface-hover/30">
          {/* Questionnaire */}
          {foyer && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Questionnaire
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {foyer.habitat && <Info label="Habitat" value={String(foyer.habitat).replace(/_/g, ' ')} />}
                {foyer.proprietaire && <Info label="Statut" value={String(foyer.proprietaire).replace(/_/g, ' ')} />}
                {foyer.composition && <Info label="Foyer" value={String(foyer.composition).replace(/_/g, ' ')} />}
                {foyer.nb_enfants !== undefined && Number(foyer.nb_enfants) > 0 && (
                  <Info label="Enfants" value={`${foyer.nb_enfants} (${foyer.ages_enfants || '?'})`} />
                )}
                {foyer.autres_animaux && (
                  <Info label="Autres animaux" value={String(foyer.autres_animaux)} fullWidth />
                )}
                {foyer.experience && <Info label="Expérience" value={String(foyer.experience)} fullWidth />}
                {foyer.motivations && (
                  <Info label="Motivations" value={String(foyer.motivations)} fullWidth />
                )}
              </dl>
            </div>
          )}

          {inquiry.team_notes && (
            <div className="bg-amber-50/50 dark:bg-amber-500/10 border border-amber-500/30 rounded p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
                Notes équipe
              </div>
              {inquiry.team_notes}
            </div>
          )}

          {inquiry.refusal_reason && (
            <div className="bg-red-50/50 dark:bg-red-500/10 border border-red-500/30 rounded p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400 mb-1">
                Motif du refus
              </div>
              {inquiry.refusal_reason}
            </div>
          )}

          {/* Actions */}
          {inquiry.status === 'pending' && !refusing && (
            <div className="space-y-3 pt-2 border-t border-border">
              <textarea
                value={teamMessage}
                onChange={(e) => setTeamMessage(e.target.value)}
                rows={2}
                placeholder="Message optionnel pour le demandeur (inclus dans l'email de confirmation)"
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={doValidate}
                  disabled={isPending}
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                >
                  {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Valider et confirmer le RDV
                </button>
                <button
                  onClick={() => setRefusing(true)}
                  disabled={isPending}
                  className="flex items-center gap-1.5 bg-surface border border-red-300 text-red-600 hover:bg-red-50 px-4 py-2 rounded text-sm font-medium"
                >
                  <X size={14} />
                  Refuser
                </button>
              </div>
            </div>
          )}

          {refusing && (
            <div className="space-y-3 pt-2 border-t border-border">
              <textarea
                value={refusalReason}
                onChange={(e) => setRefusalReason(e.target.value)}
                rows={3}
                placeholder="Motif du refus (envoyé au demandeur — soyez factuel et bienveillant)"
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={doRefuse}
                  disabled={isPending}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                >
                  {isPending ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                  Confirmer le refus
                </button>
                <button
                  onClick={() => {
                    setRefusing(false)
                    setRefusalReason('')
                    setError(null)
                  }}
                  className="text-sm text-muted hover:text-text px-3 py-2"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {inquiry.status === 'rdv_confirmed' && (
            <div className="pt-2 border-t border-border">
              <button
                onClick={markRdvCompleted}
                disabled={isPending}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:opacity-90 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Marquer RDV honoré
              </button>
            </div>
          )}

          {inquiry.status === 'rdv_completed' && (
            <div className="pt-2 border-t border-border flex flex-wrap gap-2">
              <button
                onClick={markAccepted}
                disabled={isPending}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : <Heart size={14} />}
                Adoption confirmée
              </button>
              <button
                onClick={() => setRefusing(true)}
                disabled={isPending}
                className="flex items-center gap-1.5 bg-surface border border-red-300 text-red-600 hover:bg-red-50 px-4 py-2 rounded text-sm font-medium"
              >
                <X size={14} /> Refuser après RDV
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="text-xs text-muted pt-1">
            Demande reçue le{' '}
            {new Date(inquiry.created_at).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {inquiry.source === 'public_portal' && ' · via contact.sda-nord.com'}
          </div>
        </div>
      )}
    </div>
  )
}

function Info({ label, value, fullWidth }: { label: string; value: string; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? 'col-span-2' : ''}>
      <dt className="text-xs uppercase tracking-wider text-muted mb-0.5">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  )
}
