import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarCheck, Settings, AlertTriangle } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getEstablishmentMembers } from '@/lib/actions/establishments'
import { getAvailableAdoptionSlots } from '@/lib/actions/adoption-appointments'

export default async function DisponibilitesPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.permissions.canManagePlanning) redirect('/dashboard')

  const [result, { data: members }] = await Promise.all([
    getAvailableAdoptionSlots(),
    getEstablishmentMembers(),
  ])

  const userNames: Record<string, string> = {}
  for (const m of members || []) {
    userNames[m.user_id] = m.full_name || m.pseudo || m.email || m.user_id
  }

  // Group slots by date
  const slotsByDate = new Map<string, typeof result.slots>()
  for (const s of result.slots) {
    const arr = slotsByDate.get(s.date) ?? []
    arr.push(s)
    slotsByDate.set(s.date, arr)
  }

  const totalSlots = result.slots.length
  const totalDays = slotsByDate.size

  return (
    <div className="animate-fade-up max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10">
            <CalendarCheck className="w-6 h-6 text-success" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Créneaux RDV adoption disponibles</h1>
            <p className="text-sm text-muted mt-1">
              Aperçu en temps réel des créneaux que verront les visiteurs sur le portail public
            </p>
          </div>
        </div>
        <Link
          href="/etablissement"
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <Settings className="w-4 h-4" />
          Paramétrer
        </Link>
      </div>

      {/* Bandeau désactivé */}
      {!result.settings.enabled && (
        <div className="flex items-start gap-3 p-4 mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-text mb-1">Prise de RDV publique désactivée</p>
            <p className="text-muted">
              Pour permettre les réservations depuis le portail public, activez la fonctionnalité dans{' '}
              <Link href="/etablissement" className="text-primary underline">
                Paramétrage de l'établissement
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {/* Stats résumé */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Créneaux libres" value={totalSlots} />
        <StatCard label="Jours avec créneaux" value={totalDays} />
        <StatCard label="Du" value={result.fromDate} small />
        <StatCard label="Au" value={result.toDate} small />
      </div>

      {/* Liste des créneaux */}
      {totalSlots === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <p className="text-muted">
            Aucun créneau disponible sur la période. Vérifiez que :
          </p>
          <ul className="text-sm text-muted mt-3 space-y-1 inline-block text-left">
            <li>• Au moins un collaborateur habilité est configuré</li>
            <li>• Les collaborateurs habilités sont planifiés sur les horaires d'ouverture</li>
            <li>• Les horaires d'ouverture sont définis</li>
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          {[...slotsByDate.entries()].map(([date, slots]) => (
            <div key={date} className="bg-surface rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold mb-3">{formatFrenchDate(date)}</h3>
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <div
                    key={`${s.date}-${s.start_time}`}
                    className="flex items-center gap-2 px-3 py-2 bg-success/10 border border-success/30 rounded-lg text-sm"
                    title={`Disponibles : ${s.available_user_ids.map((id) => userNames[id] ?? id).join(', ')}`}
                  >
                    <span className="font-medium">{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</span>
                    <span className="text-xs text-muted">
                      {s.available_user_ids.length} dispo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4 text-center">
      <p className={`font-bold ${small ? 'text-base' : 'text-2xl'}`}>{value}</p>
      <p className="text-xs text-muted mt-1">{label}</p>
    </div>
  )
}

function formatFrenchDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
