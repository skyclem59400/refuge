'use client'

import { useEffect, useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { HandHeart, Heart, Euro, ArrowRight, XCircle, Loader2 } from 'lucide-react'
import { AnimalStatusBadge } from '@/components/animals/animal-status-badge'
import { getSpeciesEmoji, getSpeciesLabel } from '@/lib/species'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import {
  endSponsorship,
  getSponsorshipsForClient,
} from '@/lib/actions/sponsorships'
import {
  SPONSORSHIP_ENDED_REASON_LABELS,
  SPONSORSHIP_KIND_LABELS,
  type SponsorshipEndedReason,
  type SponsorshipKind,
  type SponsorshipWithAnimal,
} from '@/lib/types/database'

interface ClientSponsorshipsSectionProps {
  clientId: string
  canEdit: boolean
  initialData?: SponsorshipWithAnimal[]
}

const KIND_BADGE_CLASSES: Record<SponsorshipKind, string> = {
  financial_monthly: 'bg-primary/15 text-primary',
  financial_punctual: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  symbolic: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
}

const MANUAL_END_REASONS: SponsorshipEndedReason[] = [
  'sponsor_cancelled',
  'sponsor_deceased',
  'other',
]

export function ClientSponsorshipsSection({
  clientId,
  canEdit,
  initialData,
}: Readonly<ClientSponsorshipsSectionProps>) {
  const [sponsorships, setSponsorships] = useState<SponsorshipWithAnimal[]>(
    initialData ?? [],
  )
  const [loading, setLoading] = useState(!initialData)

  useEffect(() => {
    if (initialData) return
    let active = true
    getSponsorshipsForClient(clientId).then((res) => {
      if (!active) return
      if (res.data) setSponsorships(res.data)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [clientId, initialData])

  const active = sponsorships.filter((s) => s.status === 'active')
  const ended = sponsorships.filter((s) => s.status === 'ended')
  const pending = sponsorships.filter((s) => s.status === 'pending')
  const monthlyTotal = active
    .filter((s) => s.kind === 'financial_monthly')
    .reduce((sum, s) => sum + (Number(s.monthly_amount) || 0), 0)

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="p-5 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HandHeart className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Parrainages</h3>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/15 text-primary">
          {active.length} actif{active.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Bandeau résumé */}
      {active.length > 0 && (
        <div className="px-5 py-3 border-b border-border bg-surface-dark/40 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 text-text">
            <Heart className="w-3.5 h-3.5 text-primary" />
            Parraine <strong>{active.length}</strong> animal{active.length > 1 ? 'aux' : ''}
          </span>
          {monthlyTotal > 0 && (
            <>
              <span className="text-muted">·</span>
              <span className="inline-flex items-center gap-1.5 text-text">
                <Euro className="w-3.5 h-3.5 text-primary" />
                Engagement <strong>{formatCurrency(monthlyTotal)}</strong>/mois
              </span>
            </>
          )}
        </div>
      )}

      <div className="p-5">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Chargement…
          </div>
        ) : sponsorships.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">
            Ce client ne parraine actuellement aucun animal
          </p>
        ) : (
          <div className="space-y-6">
            {active.length > 0 && (
              <SponsorshipsGrid items={active} canEdit={canEdit} />
            )}
            {pending.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                  En attente
                </h4>
                <SponsorshipsGrid items={pending} canEdit={canEdit} />
              </div>
            )}
            {ended.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                  Parrainages terminés
                </h4>
                <SponsorshipsGrid items={ended} canEdit={false} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SponsorshipsGrid({
  items,
  canEdit,
}: Readonly<{ items: SponsorshipWithAnimal[]; canEdit: boolean }>) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((s) => (
        <SponsorshipCard key={s.id} sponsorship={s} canEdit={canEdit} />
      ))}
    </div>
  )
}

function SponsorshipCard({
  sponsorship,
  canEdit,
}: Readonly<{ sponsorship: SponsorshipWithAnimal; canEdit: boolean }>) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showEndMenu, setShowEndMenu] = useState(false)

  const { animal } = sponsorship
  const isEnded = sponsorship.status === 'ended'
  const isActive = sponsorship.status === 'active'

  function handleEnd(reason: SponsorshipEndedReason) {
    if (
      !confirm(
        `Terminer ce parrainage (raison : ${SPONSORSHIP_ENDED_REASON_LABELS[reason]}) ?`,
      )
    ) {
      return
    }
    startTransition(async () => {
      const res = await endSponsorship(sponsorship.id, reason)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Parrainage terminé')
        setShowEndMenu(false)
        router.refresh()
      }
    })
  }

  return (
    <div
      className={`relative rounded-xl border border-border bg-surface-dark/40 overflow-hidden transition-all ${
        isEnded ? 'opacity-60' : 'hover:border-primary/40'
      }`}
    >
      {/* Photo / fallback */}
      <div className="relative aspect-[4/3] bg-surface-dark flex items-center justify-center overflow-hidden">
        {animal?.photo_url ? (
          <Image
            src={animal.photo_url}
            alt={animal.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <span className="text-5xl">{getSpeciesEmoji(animal?.species)}</span>
        )}
        {animal?.status && (
          <div className="absolute top-2 right-2">
            <AnimalStatusBadge status={animal.status} overlay />
          </div>
        )}
      </div>

      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {animal?.id ? (
              <Link
                href={`/animals/${animal.id}`}
                className="font-semibold hover:text-primary inline-flex items-center gap-1 truncate"
              >
                {animal.name}
              </Link>
            ) : (
              <span className="font-semibold text-muted">— Animal introuvable</span>
            )}
            <p className="text-xs text-muted">{getSpeciesLabel(animal?.species)}</p>
          </div>
          <span
            className={`shrink-0 inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${KIND_BADGE_CLASSES[sponsorship.kind]}`}
          >
            {SPONSORSHIP_KIND_LABELS[sponsorship.kind]}
          </span>
        </div>

        <div className="text-xs text-muted space-y-1">
          <p>Depuis le {formatDateShort(sponsorship.started_at)}</p>
          {sponsorship.kind === 'financial_monthly' && sponsorship.monthly_amount && (
            <p className="text-text font-medium">
              {formatCurrency(Number(sponsorship.monthly_amount))} / mois
            </p>
          )}
        </div>

        {isEnded && (
          <div className="pt-2 border-t border-border space-y-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-muted/15 text-muted">
              <XCircle className="w-3 h-3" />
              Terminé
              {sponsorship.ended_reason
                ? ` · ${SPONSORSHIP_ENDED_REASON_LABELS[sponsorship.ended_reason]}`
                : ''}
              {sponsorship.ended_at ? ` · ${formatDateShort(sponsorship.ended_at)}` : ''}
            </span>
            <Link
              href="/animals?status=shelter"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Proposer un autre filleul
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {isActive && canEdit && (
          <div className="pt-2 border-t border-border">
            {!showEndMenu ? (
              <button
                type="button"
                onClick={() => setShowEndMenu(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-red-500 transition-colors"
              >
                <XCircle className="w-3 h-3" />
                Terminer le parrainage
              </button>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Motif de fin
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {MANUAL_END_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      disabled={isPending}
                      onClick={() => handleEnd(reason)}
                      className="px-2 py-1 rounded text-[11px] font-medium bg-surface border border-border hover:border-red-500/40 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      {SPONSORSHIP_ENDED_REASON_LABELS[reason]}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowEndMenu(false)}
                    disabled={isPending}
                    className="px-2 py-1 rounded text-[11px] font-medium text-muted hover:text-text transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                </div>
                {isPending && (
                  <p className="text-[11px] text-muted inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Enregistrement…
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
