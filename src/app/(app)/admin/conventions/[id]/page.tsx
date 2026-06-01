import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Calendar, MapPin, Users, Banknote, Building2, Sparkles } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getConventionById } from '@/lib/actions/conventions'
import type { ConventionContract } from '@/lib/actions/conventions-types'
import { STATUS_LABELS, STATUS_CLASSES, formatCents } from '@/lib/actions/conventions-types'

export const dynamic = 'force-dynamic'

export default async function ConventionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/setup')
  if (!ctx.permissions.canManageEstablishment) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-display">Permissions insuffisantes</h1>
      </div>
    )
  }

  const res = await getConventionById(id)
  if (res.error || !res.data) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Link href="/admin/conventions" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>
        <h1 className="text-2xl font-display mt-4">Convention introuvable</h1>
        <p className="text-muted mt-2">{res.error || 'Aucun résultat pour cet identifiant.'}</p>
      </div>
    )
  }
  const c = res.data as ConventionContract

  return (
    <div className="animate-fade-up p-4 md:p-8 max-w-4xl mx-auto">
      <Link href="/admin/conventions" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-4">
        <ArrowLeft className="w-4 h-4" /> Toutes les conventions
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted font-mono">
            {c.contract_number}
            {c.newly_added && (
              <span className="inline-flex items-center gap-1 text-warning">
                <Sparkles className="w-3 h-3 fill-current" /> Nouveau
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-display text-text mt-1">{c.scope_name}</h1>
        </div>
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${STATUS_CLASSES[c.status]}`}>
          {STATUS_LABELS[c.status]}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card icon={Building2} title="Périmètre">
          <KV k="Type" v={c.epci_code_siren ? 'EPCI' : 'Commune indépendante'} />
          <KV k="Population" v={c.population_reference.toLocaleString('fr-FR')} />
          {c.epci_code_siren && <KV k="Code SIREN" v={c.epci_code_siren} mono />}
          {c.municipality_code_insee && <KV k="Code INSEE" v={c.municipality_code_insee} mono />}
        </Card>

        <Card icon={Users} title="Signataire">
          <KV k="Nom" v={c.signatory_name || '—'} />
          <KV k="Fonction" v={c.signatory_role || '—'} />
          <KV k="Email" v={c.signatory_email || '—'} />
          <KV k="Téléphone" v={c.signatory_phone || '—'} />
        </Card>

        <Card icon={Banknote} title="Conditions financières">
          <KV k="Taux par habitant" v={`${(c.rate_per_inhabitant_cents / 100).toFixed(2)} €`} />
          <KV k="Cotisation annuelle" v={formatCents(Number(c.yearly_fee_cents))} bold />
          <KV k="BPU nuit (semaine)" v={formatCents(Number(c.night_intervention_fee_cents))} />
          <KV k="Majoration dim/férié" v={`+ ${formatCents(Number(c.night_holiday_surcharge_cents))}`} />
        </Card>

        <Card icon={Calendar} title="Durée">
          <KV k="Durée du contrat" v={`${c.duration_years} ans`} />
          <KV k="Date de signature" v={c.signed_date ? new Date(c.signed_date).toLocaleDateString('fr-FR') : 'Non signé'} />
          <KV k="Début" v={c.start_date ? new Date(c.start_date).toLocaleDateString('fr-FR') : '—'} />
          <KV k="Fin" v={c.end_date ? new Date(c.end_date).toLocaleDateString('fr-FR') : '—'} />
          {c.signature_method && (
            <KV k="Méthode" v={c.signature_method === 'electronic' ? 'Électronique' : 'Papier'} />
          )}
        </Card>
      </div>

      {c.notes && (
        <Card icon={MapPin} title="Notes" className="mt-4">
          <p className="text-sm text-text whitespace-pre-wrap">{c.notes}</p>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {(c.pdf_local_path || c.pdf_url) && (
          <a
            href={`/api/conventions/${c.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 transition-colors text-sm font-medium"
          >
            <FileText className="w-4 h-4" /> Voir le PDF
          </a>
        )}
        {c.signed_pdf_url && (
          <a
            href={c.signed_pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-success/15 text-success hover:bg-success/25 transition-colors text-sm font-medium"
          >
            <FileText className="w-4 h-4" /> PDF signé
          </a>
        )}
      </div>

      <p className="text-xs text-muted mt-8">
        Créé le {new Date(c.created_at).toLocaleDateString('fr-FR')} — Mis à jour le{' '}
        {new Date(c.updated_at).toLocaleDateString('fr-FR')}
      </p>
    </div>
  )
}

function Card({
  icon: Icon,
  title,
  children,
  className = '',
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted">
        <Icon className="w-4 h-4 text-accent" />
        {title}
      </div>
      <div className="space-y-1.5 text-sm">{children}</div>
    </div>
  )
}

function KV({ k, v, mono = false, bold = false }: { k: string; v: string; mono?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className={`text-text ${mono ? 'font-mono text-xs' : ''} ${bold ? 'font-semibold' : ''}`}>{v}</span>
    </div>
  )
}
