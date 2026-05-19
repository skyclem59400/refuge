'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Heart,
  Send,
  Mail,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  X,
  FileText,
  Calendar,
} from 'lucide-react'
import { ClientSearch } from '@/components/clients/client-search'
import {
  createAndSendEngagementCertificate,
  cancelPreReservation,
} from '@/lib/actions/engagement-certificates'
import type { Client, EngagementCertificate, EngagementCertificateStatus } from '@/lib/types/database'

interface EngagementCertificateWithAdopter extends EngagementCertificate {
  adopter?: {
    id: string
    kind: 'person' | 'organization'
    name: string
    first_name: string | null
    email: string | null
    phone: string | null
    city: string | null
  } | null
}

interface PreReservationBannerProps {
  animalId: string
  animalName: string
  animalStatus: string
  preReservationClientId: string | null
  certificate: EngagementCertificateWithAdopter | null
  establishmentId: string
  canManage: boolean
}

const PRESENT_STATUSES = ['shelter', 'pound', 'boarding', 'foster_family']

function diffDays(fromIso: string, toIso: string): number {
  const from = new Date(fromIso)
  const to = new Date(toIso)
  // Diff en jours calendaires (UTC noon pour éviter les soucis DST)
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.floor((toUtc - fromUtc) / (1000 * 60 * 60 * 24))
}

function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function statusToLabel(status: EngagementCertificateStatus): string {
  switch (status) {
    case 'draft': return 'Brouillon'
    case 'sent': return 'Envoyé pour signature'
    case 'signed': return 'Signé'
    case 'expired': return 'Expiré'
    case 'cancelled': return 'Annulé'
    default: return status
  }
}

function getAdopterDisplayName(adopter: EngagementCertificateWithAdopter['adopter']): string {
  if (!adopter) return 'Adoptant'
  if (adopter.kind === 'organization') return adopter.name
  return adopter.first_name ? `${adopter.first_name} ${adopter.name}` : adopter.name
}

export function PreReservationBanner({
  animalId,
  animalName,
  animalStatus,
  preReservationClientId,
  certificate,
  establishmentId,
  canManage,
}: Readonly<PreReservationBannerProps>) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const animalIsPresent = PRESENT_STATUSES.includes(animalStatus)
  const hasActiveReservation = !!preReservationClientId && !!certificate
  const today = new Date().toISOString().split('T')[0]

  // Pas d'animal présent et pas de cert → rien
  if (!animalIsPresent && !hasActiveReservation) return null

  // Aucun certificat en cours, animal présent → bouton "Pré-réserver"
  if (!hasActiveReservation && animalIsPresent && canManage) {
    return (
      <>
        <div className="mb-6 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Heart className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text">Adoption envisagée ?</h3>
                <p className="text-xs text-muted">
                  Démarrez le processus avec le certificat d&apos;engagement (obligatoire avant adoption — 7 jours de réflexion).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors shadow-sm"
            >
              <Heart className="w-4 h-4" />
              Pré-réserver pour adoption
            </button>
          </div>
        </div>

        {showModal && (
          <PreReservationModal
            animalName={animalName}
            establishmentId={establishmentId}
            selectedClient={selectedClient}
            setSelectedClient={setSelectedClient}
            notes={notes}
            setNotes={setNotes}
            isPending={isPending}
            onClose={() => {
              setShowModal(false)
              setSelectedClient(null)
              setNotes('')
            }}
            onSubmit={() => {
              if (!selectedClient) {
                toast.error('Sélectionnez un adoptant')
                return
              }
              if (!selectedClient.email) {
                toast.error("L'adoptant doit avoir un email pour recevoir le certificat")
                return
              }
              startTransition(async () => {
                const result = await createAndSendEngagementCertificate({
                  animal_id: animalId,
                  client_id: selectedClient.id,
                  notes: notes || null,
                })
                if ('error' in result && result.error) {
                  toast.error(result.error)
                  return
                }
                toast.success(`Certificat d'engagement envoyé à ${selectedClient.email}`)
                setShowModal(false)
                setSelectedClient(null)
                setNotes('')
                router.refresh()
              })
            }}
          />
        )}
      </>
    )
  }

  // Certificat actif → bandeau d'état
  if (hasActiveReservation && certificate) {
    const adopterName = getAdopterDisplayName(certificate.adopter)
    const canFinalize = certificate.status === 'signed' && certificate.can_finalize_at && certificate.can_finalize_at <= today
    const isWaitingDelay = certificate.status === 'signed' && certificate.can_finalize_at && certificate.can_finalize_at > today

    let bannerColor = 'from-amber-500/10 to-orange-500/10 border-amber-500/30'
    let iconBg = 'bg-amber-500/20'
    let iconColor = 'text-amber-600'
    let StatusIcon = Clock

    if (canFinalize) {
      bannerColor = 'from-success/10 to-teal-500/10 border-success/30'
      iconBg = 'bg-success/20'
      iconColor = 'text-success'
      StatusIcon = CheckCircle2
    } else if (certificate.status === 'sent') {
      bannerColor = 'from-blue-500/10 to-cyan-500/10 border-blue-500/30'
      iconBg = 'bg-blue-500/20'
      iconColor = 'text-blue-600'
      StatusIcon = Mail
    } else if (certificate.status === 'signed') {
      bannerColor = 'from-amber-500/10 to-orange-500/10 border-amber-500/30'
      iconBg = 'bg-amber-500/20'
      iconColor = 'text-amber-600'
      StatusIcon = Calendar
    }

    return (
      <div className={`mb-6 bg-gradient-to-r ${bannerColor} border rounded-xl p-4`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
              <StatusIcon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-text">
                  Pré-réservé pour {adopterName}
                </h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${iconBg} ${iconColor}`}>
                  {statusToLabel(certificate.status)}
                </span>
              </div>

              {certificate.status === 'sent' && (
                <p className="text-xs text-muted mt-1">
                  Certificat d&apos;engagement envoyé{certificate.delivered_at ? ` le ${formatDateFr(certificate.delivered_at)}` : ''}
                  {certificate.adopter?.email && (
                    <> à <span className="font-medium text-text">{certificate.adopter.email}</span></>
                  )}
                  {' '}— en attente de signature.
                </p>
              )}

              {isWaitingDelay && certificate.signed_at && certificate.can_finalize_at && (
                <div className="mt-1">
                  <p className="text-xs text-muted">
                    Certificat signé le <span className="font-medium text-text">{formatDateFr(certificate.signed_at)}</span>
                    {' '}— adoption possible à partir du <span className="font-medium text-text">{formatDateFr(certificate.can_finalize_at)}</span>
                  </p>
                  <DelayProgress signedAt={certificate.signed_at} canFinalizeAt={certificate.can_finalize_at} />
                </div>
              )}

              {canFinalize && (
                <p className="text-xs text-muted mt-1">
                  Délai légal de 7 jours respecté — l&apos;adoption peut être finalisée.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {certificate.documenso_signing_url && certificate.status === 'sent' && (
              <a
                href={certificate.documenso_signing_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-dark border border-border text-xs font-medium transition-colors"
                title="Lien de signature"
              >
                <Send className="w-3.5 h-3.5" />
                Lien signature
              </a>
            )}
            <Link
              href={`/api/pdf/engagement-certificate/${certificate.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-dark border border-border text-xs font-medium transition-colors"
              title="Voir le PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              PDF
            </Link>
            {canFinalize && canManage && (
              <Link
                href={`/animals/${animalId}#adoption-tab`}
                onClick={(e) => {
                  e.preventDefault()
                  // Scroll vers la tab adoption (l'utilisateur cliquera sur l'onglet manuellement)
                  toast.info("Rendez-vous dans l'onglet « Adoption » pour créer le contrat final.")
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success hover:bg-success/90 text-white text-xs font-medium transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Finaliser l&apos;adoption
              </Link>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm(`Annuler la pré-réservation pour ${adopterName} ? L'animal redeviendra disponible.`)) return
                  startTransition(async () => {
                    const result = await cancelPreReservation(animalId)
                    if ('error' in result && result.error) {
                      toast.error(result.error)
                      return
                    }
                    toast.success('Pré-réservation annulée')
                    router.refresh()
                  })
                }}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/10 hover:bg-error/20 text-error text-xs font-medium transition-colors disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                Annuler
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}

function DelayProgress({ signedAt, canFinalizeAt }: Readonly<{ signedAt: string; canFinalizeAt: string }>) {
  const today = new Date().toISOString().split('T')[0]
  const totalDays = 7
  const elapsedDays = Math.min(diffDays(signedAt, today), totalDays)
  const daysLeft = Math.max(diffDays(today, canFinalizeAt), 0)
  const pct = Math.min(Math.max((elapsedDays / totalDays) * 100, 0), 100)

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-dark rounded-full overflow-hidden max-w-xs">
        <div
          className="h-full bg-amber-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-amber-600 whitespace-nowrap">
        J+{elapsedDays}/7 · {daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}
      </span>
    </div>
  )
}

interface PreReservationModalProps {
  animalName: string
  establishmentId: string
  selectedClient: Client | null
  setSelectedClient: (client: Client | null) => void
  notes: string
  setNotes: (notes: string) => void
  isPending: boolean
  onClose: () => void
  onSubmit: () => void
}

function PreReservationModal({
  animalName,
  establishmentId,
  selectedClient,
  setSelectedClient,
  notes,
  setNotes,
  isPending,
  onClose,
  onSubmit,
}: Readonly<PreReservationModalProps>) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center">
              <Heart className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Pré-réserver {animalName}</h2>
              <p className="text-xs text-muted">Envoi du certificat d&apos;engagement</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-text transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs text-muted leading-relaxed">
            <p className="font-medium text-amber-700 mb-1">Délai légal de 7 jours</p>
            <p>
              Conformément à la loi du 30 novembre 2021, l&apos;adoptant signe d&apos;abord un certificat d&apos;engagement.
              Un délai obligatoire de 7 jours calendaires s&apos;écoule avant de pouvoir finaliser l&apos;adoption.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Adoptant <span className="text-error">*</span>
            </label>
            <ClientSearch
              onSelect={setSelectedClient}
              selected={selectedClient}
              establishmentId={establishmentId}
              placeholder="Rechercher l'adoptant par nom, email..."
              enableQuickCreate={false}
            />
            {selectedClient && !selectedClient.email && (
              <p className="text-xs text-error mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Cet adoptant n&apos;a pas d&apos;email — ajoutez-en un avant l&apos;envoi.
              </p>
            )}
            {selectedClient?.email && (
              <p className="text-xs text-muted mt-1">
                Le certificat sera envoyé à <span className="font-medium text-text">{selectedClient.email}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Notes internes <span className="text-muted">(optionnel)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Contexte, conditions particulières..."
              className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm
                focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                placeholder:text-muted/50 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-border bg-surface-dark/30">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-surface-dark transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isPending || !selectedClient || !selectedClient.email}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Envoi en cours…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Envoyer le certificat
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
