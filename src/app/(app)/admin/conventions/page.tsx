import { redirect } from 'next/navigation'
import { FileSignature, Sparkles, TrendingUp, Wallet, CheckCircle2 } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { listConventionsForAdmin } from '@/lib/actions/conventions'
import type { ConventionContract } from '@/lib/actions/conventions-types'
import { formatCents } from '@/lib/actions/conventions-types'
import { ConventionsListClient } from '@/components/conventions/conventions-list-client'

export const dynamic = 'force-dynamic'

export default async function AdminConventionsPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/setup')
  if (!ctx.permissions.canManageEstablishment) {
    return (
      <div className="animate-fade-up p-8">
        <h1 className="text-2xl font-display">Permissions insuffisantes</h1>
        <p className="text-muted mt-2">Tu dois avoir le droit de gestion établissement pour voir cette page.</p>
      </div>
    )
  }

  const res = await listConventionsForAdmin()
  const list = (res.data || []) as ConventionContract[]

  const stats = {
    total: list.length,
    signed: list.filter((c) => c.status === 'signed').length,
    ready: list.filter((c) => c.status === 'ready').length,
    sent: list.filter((c) => c.status === 'sent').length,
    newly: list.filter((c) => c.newly_added).length,
    yearly_total_signed_cents: list
      .filter((c) => c.status === 'signed')
      .reduce((s, c) => s + Number(c.yearly_fee_cents), 0),
    yearly_total_all_cents: list.reduce((s, c) => s + Number(c.yearly_fee_cents), 0),
  }

  return (
    <div className="animate-fade-up p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-accent/15 text-accent">
          <FileSignature className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-display text-text">Conventions de fourrière</h1>
          <p className="text-sm text-muted">Contrats EPCI + communes indépendantes — 1,25 € / habitant / an.</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
        <StatCard label="Total" value={stats.total.toString()} sub={`dont ${stats.newly} nouveau${stats.newly > 1 ? 'x' : ''}`} Icon={FileSignature} accent="text" />
        <StatCard label="Signés" value={stats.signed.toString()} Icon={CheckCircle2} accent="success" />
        <StatCard label="À envoyer" value={stats.ready.toString()} Icon={Sparkles} accent="warning" />
        <StatCard label="Recettes signées" value={formatCents(stats.yearly_total_signed_cents)} sub="par an" Icon={TrendingUp} accent="success" />
        <StatCard label="Potentiel total" value={formatCents(stats.yearly_total_all_cents)} sub="si tout signé" Icon={Wallet} accent="accent" />
      </div>

      <div className="mt-8">
        <ConventionsListClient initialList={list} />
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  Icon: React.ComponentType<{ className?: string }>
  accent: 'text' | 'success' | 'warning' | 'accent'
}) {
  const accentClass =
    accent === 'success'
      ? 'text-success'
      : accent === 'warning'
        ? 'text-warning'
        : accent === 'accent'
          ? 'text-accent'
          : 'text-text'
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 mb-1 text-xs text-muted uppercase tracking-wide">
        <Icon className={`w-3.5 h-3.5 ${accentClass}`} />
        {label}
      </div>
      <div className={`text-xl font-semibold ${accentClass}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  )
}
