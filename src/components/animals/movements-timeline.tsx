'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Truck,
  Home,
  House,
  Heart,
  HeartCrack,
  Bookmark,
  BookmarkX,
  ArrowLeft,
  ArrowRight,
  Mail,
  Phone,
  MapPin,
  StickyNote,
  Clock,
  Send,
  RefreshCw,
  XCircle,
  FileDown,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Upload,
} from 'lucide-react'
import { getMovementLabel } from '@/lib/sda-utils'
import { sendContractForSignature, syncContractSignatureStatus } from '@/lib/actions/foster-contract-signature'
import { sendAdoptionContractForSignature, syncAdoptionContractSignatureStatus } from '@/lib/actions/adoption-contract-signature'
import { cancelPendingMovement, markMovementSignedManually } from '@/lib/actions/movement-with-contract'
import type { AnimalMovement, MovementType } from '@/lib/types/database'

interface MovementWithRelations extends AnimalMovement {
  related_client?: { id: string; name: string } | null
}

interface MovementsTimelineProps {
  movements: MovementWithRelations[]
  userNames: Record<string, string>
}

// Per-type visual config: icon + accent color (Tailwind tokens already in globals)
const movementVisuals: Record<MovementType, { icon: typeof Truck; bg: string; ring: string; text: string; badge: string }> = {
  pound_entry:           { icon: Truck,        bg: 'bg-amber-500',   ring: 'ring-amber-500/30',   text: 'text-amber-600',   badge: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  shelter_transfer:      { icon: House,        bg: 'bg-blue-500',    ring: 'ring-blue-500/30',    text: 'text-blue-600',    badge: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  foster_placement:      { icon: Home,         bg: 'bg-purple-500',  ring: 'ring-purple-500/30',  text: 'text-purple-600',  badge: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
  adoption:              { icon: Heart,        bg: 'bg-emerald-500', ring: 'ring-emerald-500/30', text: 'text-emerald-600', badge: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  return_to_owner:       { icon: ArrowLeft,    bg: 'bg-cyan-500',    ring: 'ring-cyan-500/30',    text: 'text-cyan-600',    badge: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30' },
  transfer_out:          { icon: ArrowRight,   bg: 'bg-slate-500',   ring: 'ring-slate-500/30',   text: 'text-slate-600',   badge: 'bg-slate-500/15 text-slate-600 border-slate-500/30' },
  death:                 { icon: HeartCrack,   bg: 'bg-red-700',     ring: 'ring-red-700/30',     text: 'text-red-700',     badge: 'bg-red-700/15 text-red-700 border-red-700/30' },
  euthanasia:            { icon: HeartCrack,   bg: 'bg-red-500',     ring: 'ring-red-500/30',     text: 'text-red-500',     badge: 'bg-red-500/15 text-red-500 border-red-500/30' },
  reservation:           { icon: Bookmark,     bg: 'bg-amber-400',   ring: 'ring-amber-400/30',   text: 'text-amber-500',   badge: 'bg-amber-400/15 text-amber-500 border-amber-400/30' },
  reservation_cancelled: { icon: BookmarkX,    bg: 'bg-muted',       ring: 'ring-muted/30',       text: 'text-muted',       badge: 'bg-muted/15 text-muted border-muted/30' },
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  // Only show the time if the original timestamp has a meaningful HH:MM (i.e. not midnight UTC for date-only fields)
  const hours = d.getHours()
  const minutes = d.getMinutes()
  if (hours === 0 && minutes === 0) return ''
  return `à ${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}`
}

function formatElapsed(fromIso: string): string {
  const from = new Date(fromIso)
  const now = new Date()
  const diffMs = now.getTime() - from.getTime()
  if (diffMs < 0) return ''
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `il y a ${diffD} jour${diffD > 1 ? 's' : ''}`
  const diffMo = Math.floor(diffD / 30)
  if (diffMo < 12) {
    const remDays = diffD - diffMo * 30
    if (remDays === 0) return `il y a ${diffMo} mois`
    return `il y a ${diffMo} mois ${remDays} j`
  }
  const diffY = Math.floor(diffMo / 12)
  const remMo = diffMo - diffY * 12
  if (remMo === 0) return `il y a ${diffY} an${diffY > 1 ? 's' : ''}`
  return `il y a ${diffY} an${diffY > 1 ? 's' : ''} ${remMo} mois`
}

function avatarInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('') || '?'
}

const signatureBadgeStyles: Record<string, { label: string; className: string }> = {
  pending:      { label: 'En attente de signature', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  signed:       { label: 'Signé',                   className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  rejected:     { label: 'Refusé',                  className: 'bg-red-500/15 text-red-500 border-red-500/30' },
  cancelled:    { label: 'Annulé',                  className: 'bg-muted/15 text-muted border-muted/30' },
  not_required: { label: '',                        className: '' },
}

export function MovementsTimeline({ movements, userNames }: Readonly<MovementsTimelineProps>) {
  const router = useRouter()
  const [actingId, setActingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleResend(mv: MovementWithRelations) {
    if (!mv.related_contract_id || !mv.related_contract_type) return
    if (!window.confirm('Renvoyer le contrat pour signature électronique ?')) return
    setActingId(mv.id)
    startTransition(async () => {
      const fn = mv.related_contract_type === 'adoption' ? sendAdoptionContractForSignature : sendContractForSignature
      const res = await fn(mv.related_contract_id!)
      setActingId(null)
      if (res.error) toast.error(res.error)
      else { toast.success('Contrat renvoyé pour signature'); router.refresh() }
    })
  }

  function handleSync(mv: MovementWithRelations) {
    if (!mv.related_contract_id || !mv.related_contract_type) return
    setActingId(mv.id)
    startTransition(async () => {
      const fn = mv.related_contract_type === 'adoption' ? syncAdoptionContractSignatureStatus : syncContractSignatureStatus
      const res = await fn(mv.related_contract_id!)
      setActingId(null)
      if (res.error) toast.error(res.error)
      else { toast.success(`Statut Documenso : ${res.data?.status}`); router.refresh() }
    })
  }

  function handleCancel(mv: MovementWithRelations) {
    if (!window.confirm('Annuler ce mouvement en attente ? Le contrat lié sera supprimé. (Le mouvement n\'avait pas encore d\'effet juridique.)')) return
    setActingId(mv.id)
    startTransition(async () => {
      const res = await cancelPendingMovement(mv.id)
      setActingId(null)
      if (res.error) toast.error(res.error)
      else { toast.success('Mouvement et contrat annulés'); router.refresh() }
    })
  }

  function handleMarkSignedManually(mv: MovementWithRelations) {
    const choice = window.prompt(
      "Marquer ce mouvement comme signé manuellement (signature papier) ?\n\n" +
      "Tapez OK pour valider sans uploader, ou tapez UPLOAD pour téléverser le PDF scanné.",
      'OK'
    )
    if (!choice) return
    const upload = choice.trim().toUpperCase() === 'UPLOAD'

    if (!upload) {
      setActingId(mv.id)
      startTransition(async () => {
        const res = await markMovementSignedManually({ movementId: mv.id })
        setActingId(null)
        if (res.error) toast.error(res.error)
        else { toast.success('Mouvement marqué signé manuellement'); router.refresh() }
      })
      return
    }

    // Upload flow
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/pdf'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > 10 * 1024 * 1024) { toast.error('PDF trop volumineux (10 Mo max)'); return }
      setActingId(mv.id)
      const reader = new FileReader()
      reader.onload = () => {
        const result = String(reader.result || '')
        const base64 = result.split(',')[1] || ''
        startTransition(async () => {
          const res = await markMovementSignedManually({
            movementId: mv.id,
            scannedPdfBase64: base64,
            scannedPdfFileName: file.name,
          })
          setActingId(null)
          if (res.error) toast.error(res.error)
          else { toast.success('PDF scanné uploadé et mouvement marqué signé'); router.refresh() }
        })
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  if (movements.length === 0) {
    return <div className="bg-surface rounded-xl border border-border p-8 text-center text-sm text-muted">Aucun mouvement enregistré</div>
  }

  return (
    <ol className="relative space-y-4">
      {movements.map((mv, idx) => {
        const visual = movementVisuals[mv.type] ?? movementVisuals.pound_entry
        const Icon = visual.icon
        const linkedName = mv.related_client?.name || mv.person_name
        const submittedBy = (mv.created_by && userNames[mv.created_by]) || null
        const isLast = idx === movements.length - 1
        const sigStatus = mv.signature_status
        const isPendingSig = sigStatus === 'pending'
        const isRejected = sigStatus === 'rejected'
        const sigBadge = sigStatus && sigStatus !== 'not_required' ? signatureBadgeStyles[sigStatus] : null
        const isActing = actingId === mv.id
        const pdfHref = mv.related_contract_id && mv.related_contract_type
          ? `/api/pdf/${mv.related_contract_type === 'adoption' ? 'adoption-contract' : 'foster-contract'}/${mv.related_contract_id}`
          : null

        return (
          <li key={mv.id} className="relative flex gap-4">
            {/* Vertical connector line on the left, behind the icon */}
            {!isLast && (
              <span aria-hidden className="absolute left-[19px] top-12 bottom-0 w-px bg-border -mb-4" />
            )}

            {/* Icon circle */}
            <div className={`relative shrink-0 w-10 h-10 rounded-full ${visual.bg} ring-4 ${visual.ring} flex items-center justify-center text-white shadow-sm`}>
              <Icon className="w-5 h-5" />
            </div>

            {/* Card */}
            <div className="flex-1 min-w-0 bg-surface rounded-xl border border-border p-4">
              {/* Header: date + badge */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="text-sm">
                  <div className="font-semibold capitalize">
                    {formatDateTime(mv.date)}
                    <span className="text-xs font-normal text-muted ml-1.5">{formatTime(mv.date)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted mt-0.5">
                    <Clock className="w-3 h-3" />
                    {formatElapsed(mv.date)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${visual.badge}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {getMovementLabel(mv.type)}
                  </span>
                  {sigBadge && (
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sigBadge.className}`}>
                      {isPendingSig && <Clock className="w-3 h-3" />}
                      {sigStatus === 'signed' && <CheckCircle2 className="w-3 h-3" />}
                      {isRejected && <AlertTriangle className="w-3 h-3" />}
                      {sigBadge.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Linked person block */}
              {linkedName && (
                <div className="mt-3 flex items-start gap-3 p-3 rounded-lg bg-surface-dark/50 border border-border/50">
                  <div className={`shrink-0 w-9 h-9 rounded-full ${visual.bg} text-white flex items-center justify-center text-xs font-bold`}>
                    {avatarInitials(linkedName)}
                  </div>
                  <div className="flex-1 min-w-0 text-sm">
                    <div className={`font-semibold ${visual.text}`}>{linkedName}</div>
                    {(mv.person_contact || mv.destination) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted">
                        {mv.person_contact?.includes('@') && (
                          <a href={`mailto:${mv.person_contact}`} className="inline-flex items-center gap-1 hover:text-primary">
                            <Mail className="w-3 h-3" /> {mv.person_contact}
                          </a>
                        )}
                        {mv.person_contact && !mv.person_contact.includes('@') && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {mv.person_contact}
                          </span>
                        )}
                        {mv.destination && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {mv.destination}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {mv.notes && (
                <div className="mt-3 flex items-start gap-2 text-xs text-muted">
                  <StickyNote className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{mv.notes}</p>
                </div>
              )}

              {/* Pending signature warning + actions */}
              {isPendingSig && (
                <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-2">
                  <p className="text-xs text-amber-600 flex items-start gap-2">
                    <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Statut animal en attente : il sera appliqué dès que le contrat sera signé.</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {pdfHref && (
                      <a
                        href={pdfHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-surface-dark hover:bg-surface-hover text-muted hover:text-text transition-colors"
                        title="Aperçu du contrat (PDF non signé)"
                      >
                        <FileDown className="w-3.5 h-3.5" /> Voir le contrat
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleResend(mv)}
                      disabled={isPending && isActing}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors disabled:opacity-50"
                    >
                      {isPending && isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Renvoyer email
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSync(mv)}
                      disabled={isPending && isActing}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-surface-dark hover:bg-surface-hover text-muted hover:text-text transition-colors disabled:opacity-50"
                      title="Synchroniser le statut avec Documenso"
                    >
                      {isPending && isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Sync
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarkSignedManually(mv)}
                      disabled={isPending && isActing}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition-colors disabled:opacity-50"
                      title="Signature papier — marquer comme signé manuellement et uploader le PDF scanné"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Signature papier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancel(mv)}
                      disabled={isPending && isActing}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors disabled:opacity-50"
                      title="Annuler ce mouvement et son contrat"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {/* Signed contract download (when finalised) */}
              {sigStatus === 'signed' && pdfHref && (
                <div className="mt-3 pt-3 border-t border-emerald-500/20 flex flex-wrap gap-1.5">
                  <a
                    href={pdfHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" /> Voir le contrat signé
                  </a>
                </div>
              )}

              {/* Footer: saisi par */}
              {submittedBy && (
                <div className="mt-3 pt-3 border-t border-border/50 text-[11px] text-muted">
                  Saisi par <span className="font-medium text-text">{submittedBy}</span>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

