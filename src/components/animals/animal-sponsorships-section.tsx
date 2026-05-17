'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  HandHeart,
  Heart,
  Euro,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react'
import {
  getSponsorshipsForAnimal,
  deleteSponsorship,
} from '@/lib/actions/sponsorships'
import {
  getClientDisplayName,
  SPONSORSHIP_KIND_LABELS,
  SPONSORSHIP_ENDED_REASON_LABELS,
  type SponsorshipWithClient,
  type SponsorshipKind,
} from '@/lib/types/database'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { SponsorshipModal, EndSponsorshipModal } from './sponsorship-modal'

interface Props {
  animalId: string
  canEdit: boolean
  animalIsPresent: boolean
  initialData?: SponsorshipWithClient[]
}

function KindIcon({ kind, className }: Readonly<{ kind: SponsorshipKind; className?: string }>) {
  if (kind === 'symbolic') return <Heart className={className} />
  return <Euro className={className} />
}

function kindBadgeClass(kind: SponsorshipKind): string {
  if (kind === 'financial_monthly') return 'bg-primary/15 text-primary'
  if (kind === 'financial_punctual') return 'bg-info/15 text-info'
  return 'bg-pink-500/15 text-pink-400'
}

export function AnimalSponsorshipsSection({
  animalId,
  canEdit,
  animalIsPresent,
  initialData,
}: Readonly<Props>) {
  const router = useRouter()
  const [sponsorships, setSponsorships] = useState<SponsorshipWithClient[] | null>(
    initialData ?? null
  )
  const [loading, setLoading] = useState(initialData === undefined)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSponsorship, setEditingSponsorship] = useState<SponsorshipWithClient | null>(null)
  const [endingSponsorship, setEndingSponsorship] = useState<SponsorshipWithClient | null>(null)

  // Initial fetch if no SSR data provided
  useEffect(() => {
    if (initialData !== undefined) return
    let cancelled = false
    getSponsorshipsForAnimal(animalId).then((res) => {
      if (cancelled) return
      if (res.error) {
        toast.error(res.error)
        setSponsorships([])
      } else {
        setSponsorships(res.data ?? [])
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [animalId, initialData])

  const list = sponsorships ?? []
  const active = list.filter((s) => s.status === 'active')
  const ended = list.filter((s) => s.status === 'ended')
  const monthlyTotal = active
    .filter((s) => s.kind === 'financial_monthly')
    .reduce((sum, s) => sum + Number(s.monthly_amount ?? 0), 0)

  function handleRefresh() {
    getSponsorshipsForAnimal(animalId).then((res) => {
      if (res.error) {
        toast.error(res.error)
      } else {
        setSponsorships(res.data ?? [])
      }
    })
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <HandHeart className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Parrains</h2>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/15 text-primary">
            {active.length} actif{active.length > 1 ? 's' : ''}
          </span>
        </div>
        {canEdit && animalIsPresent && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold gradient-primary text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Ajouter un parrain
          </button>
        )}
      </div>

      {/* Summary bar */}
      {(active.length > 0 || monthlyTotal > 0) && (
        <div className="flex items-center gap-2 px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
          <span className="font-medium">{active.length} parrain{active.length > 1 ? 's' : ''} actif{active.length > 1 ? 's' : ''}</span>
          {monthlyTotal > 0 && (
            <>
              <span className="text-muted">·</span>
              <span className="font-semibold text-primary">
                {formatCurrency(monthlyTotal)}/mois cumulés
              </span>
            </>
          )}
        </div>
      )}

      {/* Content */}
      {(() => {
        if (loading) {
          return (
            <div className="flex items-center gap-2 text-sm text-muted p-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Chargement des parrains...
            </div>
          )
        }
        if (list.length === 0) {
          return (
            <div className="bg-surface rounded-xl border border-border border-dashed p-8 text-center">
              <HandHeart className="w-10 h-10 text-muted/30 mx-auto mb-3" />
              <p className="text-sm text-muted">Aucun parrainage pour cet animal</p>
              {canEdit && animalIsPresent && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold gradient-primary text-white hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter un parrain
                </button>
              )}
              {canEdit && !animalIsPresent && (
                <p className="mt-3 text-xs text-muted">
                  Impossible d&apos;ajouter un parrain : l&apos;animal n&apos;est plus présent au refuge.
                </p>
              )}
            </div>
          )
        }
        return (
          <div className="space-y-3">
            {active.map((s) => (
              <SponsorshipCard
                key={s.id}
                sponsorship={s}
                canEdit={canEdit}
                onEdit={() => setEditingSponsorship(s)}
                onEnd={() => setEndingSponsorship(s)}
                onDeleted={handleRefresh}
              />
            ))}
            {ended.length > 0 && (
              <>
                <div className="pt-2 mt-2 border-t border-border">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                    Parrainages terminés ({ended.length})
                  </h3>
                </div>
                {ended.map((s) => (
                  <SponsorshipCard
                    key={s.id}
                    sponsorship={s}
                    canEdit={canEdit}
                    onEdit={() => setEditingSponsorship(s)}
                    onEnd={() => setEndingSponsorship(s)}
                    onDeleted={handleRefresh}
                  />
                ))}
              </>
            )}
          </div>
        )
      })()}

      {/* Modals */}
      {showAddModal && (
        <SponsorshipModal
          mode="create"
          animalId={animalId}
          onClose={() => {
            setShowAddModal(false)
            handleRefresh()
          }}
        />
      )}
      {editingSponsorship && (
        <SponsorshipModal
          mode="edit"
          animalId={animalId}
          sponsorship={editingSponsorship}
          onClose={() => {
            setEditingSponsorship(null)
            handleRefresh()
          }}
        />
      )}
      {endingSponsorship && (
        <EndSponsorshipModal
          sponsorshipId={endingSponsorship.id}
          sponsorName={
            endingSponsorship.client
              ? getClientDisplayName(endingSponsorship.client)
              : 'Parrain'
          }
          onClose={() => {
            setEndingSponsorship(null)
            handleRefresh()
          }}
        />
      )}
    </div>
  )
}

/* ============================================================
   Carte d'un parrainage
   ============================================================ */

interface CardProps {
  sponsorship: SponsorshipWithClient
  canEdit: boolean
  onEdit: () => void
  onEnd: () => void
  onDeleted: () => void
}

function SponsorshipCard({ sponsorship, canEdit, onEdit, onEnd, onDeleted }: Readonly<CardProps>) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isEnded = sponsorship.status === 'ended'
  const client = sponsorship.client

  function handleDelete() {
    if (
      !window.confirm(
        'Supprimer définitivement ce parrainage ? Cette action est irréversible.'
      )
    )
      return
    startTransition(async () => {
      const res = await deleteSponsorship(sponsorship.id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Parrainage supprimé.')
      setMenuOpen(false)
      onDeleted()
    })
  }

  return (
    <div
      className={`bg-surface border border-border rounded-xl p-4 transition-colors ${
        isEnded ? 'opacity-60' : 'hover:border-border/80'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Kind icon avatar */}
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${kindBadgeClass(sponsorship.kind)}`}
          >
            <KindIcon kind={sponsorship.kind} className="w-5 h-5" />
          </div>

          {/* Body */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {client ? (
                <Link
                  href={`/clients/${client.id}`}
                  className="font-semibold text-sm hover:text-primary transition-colors truncate"
                >
                  {getClientDisplayName(client)}
                </Link>
              ) : (
                <span className="font-semibold text-sm text-muted italic">
                  Client inconnu
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${kindBadgeClass(sponsorship.kind)}`}
              >
                {SPONSORSHIP_KIND_LABELS[sponsorship.kind]}
              </span>
              {isEnded && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-dark text-muted border border-border">
                  Terminé
                  {sponsorship.ended_reason && (
                    <span> · {SPONSORSHIP_ENDED_REASON_LABELS[sponsorship.ended_reason]}</span>
                  )}
                </span>
              )}
              {sponsorship.show_publicly ? (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-success/15 text-success"
                  title="Affichage public autorisé"
                >
                  <Eye className="w-3 h-3" />
                  Public
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-surface-dark text-muted"
                  title="Non affiché publiquement"
                >
                  <EyeOff className="w-3 h-3" />
                  Privé
                </span>
              )}
            </div>

            {/* Public alias if set */}
            {sponsorship.public_alias && (
              <div className="text-xs text-muted mt-0.5">
                Alias public : <span className="italic">{sponsorship.public_alias}</span>
              </div>
            )}

            {/* Meta line */}
            <div className="flex items-center gap-2 text-xs text-muted mt-1 flex-wrap">
              <span>Depuis le {formatDateShort(sponsorship.started_at)}</span>
              {isEnded && sponsorship.ended_at && (
                <>
                  <span>·</span>
                  <span>Terminé le {formatDateShort(sponsorship.ended_at)}</span>
                </>
              )}
              {sponsorship.kind === 'financial_monthly' && sponsorship.monthly_amount != null && (
                <>
                  <span>·</span>
                  <span className="font-medium text-text">
                    {formatCurrency(Number(sponsorship.monthly_amount))}/mois
                  </span>
                </>
              )}
              {sponsorship.total_donated != null && sponsorship.total_donated > 0 && (
                <>
                  <span>·</span>
                  <span>
                    Total versé{' '}
                    <span className="font-semibold text-text">
                      {formatCurrency(sponsorship.total_donated)}
                    </span>
                  </span>
                </>
              )}
            </div>

            {/* Notes */}
            {sponsorship.notes && (
              <p className="text-xs text-muted mt-2 p-2 bg-surface-dark rounded-md whitespace-pre-wrap">
                {sponsorship.notes}
              </p>
            )}
          </div>
        </div>

        {/* Menu actions */}
        {canEdit && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface-dark"
              aria-label="Actions"
              disabled={isPending}
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
            </button>
            {menuOpen && (
              <>
                {/* Backdrop to close on click outside */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-border rounded-lg shadow-xl min-w-[180px] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onEdit()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-dark text-left"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Modifier
                  </button>
                  {!isEnded && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        onEnd()
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-dark text-left text-warning"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Terminer
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-error/10 text-left text-error border-t border-border"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
