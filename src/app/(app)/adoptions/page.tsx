import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Heart, Mail, Phone, Calendar, AlertCircle, Inbox } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getAdoptionInquiries } from '@/lib/actions/adoption-inquiries'
import { InquiryRow } from '@/components/adoptions/inquiry-row'

export const dynamic = 'force-dynamic'

const STATUS_TABS = [
  { id: 'pending', label: 'À traiter', color: 'amber' },
  { id: 'rdv_confirmed', label: 'RDV confirmés', color: 'teal' },
  { id: 'rdv_completed', label: 'RDV honorés', color: 'green' },
  { id: 'accepted', label: 'Adoptés', color: 'green' },
  { id: 'refused', label: 'Refusés', color: 'red' },
  { id: 'cancelled', label: 'Annulés', color: 'gray' },
] as const

export default async function AdoptionsPage(props: { searchParams: Promise<{ status?: string }> }) {
  const sp = await props.searchParams
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.permissions.canManageAdoptions) redirect('/dashboard')

  const status = (STATUS_TABS.find((t) => t.id === sp.status)?.id ?? 'pending') as
    'pending' | 'rdv_confirmed' | 'rdv_completed' | 'accepted' | 'refused' | 'cancelled'

  const { data: inquiries = [], error } = await getAdoptionInquiries({ status })

  // Compteurs par status (1 requête par status — pas optimal mais OK pour MVP)
  const counts: Record<string, number> = {}
  await Promise.all(
    STATUS_TABS.map(async (t) => {
      const r = await getAdoptionInquiries({ status: t.id })
      counts[t.id] = r.data?.length ?? 0
    }),
  )

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Heart className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Demandes d'adoption</h1>
            <p className="text-sm text-muted mt-1">
              Reçues via le portail public contact.sda-nord.com
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-border">
        {STATUS_TABS.map((t) => {
          const active = t.id === status
          return (
            <Link
              key={t.id}
              href={`/adoptions?status=${t.id}`}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {t.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  active ? 'bg-primary/10 text-primary' : 'bg-surface-hover text-muted'
                }`}
              >
                {counts[t.id] ?? 0}
              </span>
            </Link>
          )
        })}
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 mb-6 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm text-destructive">{error}</div>
        </div>
      )}

      {inquiries.length === 0 && !error && (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <Inbox className="w-12 h-12 text-muted mx-auto mb-3" />
          <p className="text-muted">
            {status === 'pending'
              ? 'Aucune demande en attente. Tout est à jour.'
              : `Aucune demande ${STATUS_TABS.find((t) => t.id === status)?.label.toLowerCase()}.`}
          </p>
        </div>
      )}

      {inquiries.length > 0 && (
        <div className="space-y-3">
          {inquiries.map((inq) => (
            <InquiryRow key={inq.id} inquiry={inq} />
          ))}
        </div>
      )}

      {/* Légende stats globales */}
      <div className="mt-8 pt-6 border-t border-border grid grid-cols-3 sm:grid-cols-6 gap-3 text-xs text-muted">
        <Legend icon={<Calendar className="w-3 h-3" />} label={`${counts.pending ?? 0} à traiter`} />
        <Legend icon={<Mail className="w-3 h-3" />} label={`${counts.rdv_confirmed ?? 0} RDV à venir`} />
        <Legend icon={<Phone className="w-3 h-3" />} label={`${counts.accepted ?? 0} adoptions`} />
      </div>
    </div>
  )
}

function Legend({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span>{label}</span>
    </div>
  )
}
