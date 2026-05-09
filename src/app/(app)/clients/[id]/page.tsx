import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { ClientForm } from '@/components/clients/client-form'
import { TypeBadge, StatusBadge } from '@/components/documents/status-badge'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import type { Client, Document } from '@/lib/types/database'

interface AdoptionRow {
  id: string
  contract_number: string
  adoption_date: string
  adoption_fee: number | null
  status: string
  signature_status: string | null
  animal_id: string
  animal: { id: string; name: string; species: string | null } | null
}

interface FosterRow {
  id: string
  contract_number: string
  start_date: string
  expected_end_date: string | null
  actual_end_date: string | null
  status: string
  signature_status: string | null
  animal_id: string
  animal: { id: string; name: string; species: string | null } | null
}

interface DonationRow {
  id: string
  amount: number
  date: string
  payment_method: string
  cerfa_number: string | null
  cerfa_generated: boolean
  source: string | null
  notes: string | null
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const admin = createAdminClient()

  const [
    { data: client },
    { data: documents },
    { data: adoptions },
    { data: fosters },
  ] = await Promise.all([
    admin.from('clients').select('*').eq('id', id).eq('establishment_id', estabId).single(),
    admin
      .from('documents')
      .select('*')
      .eq('client_id', id)
      .eq('establishment_id', estabId)
      .order('created_at', { ascending: false }),
    admin
      .from('adoption_contracts')
      .select(
        'id, contract_number, adoption_date, adoption_fee, status, signature_status, animal_id, animal:animals(id, name, species)'
      )
      .eq('adopter_client_id', id)
      .eq('establishment_id', estabId)
      .order('adoption_date', { ascending: false }),
    admin
      .from('foster_contracts')
      .select(
        'id, contract_number, start_date, expected_end_date, actual_end_date, status, signature_status, animal_id, animal:animals(id, name, species)'
      )
      .eq('foster_client_id', id)
      .eq('establishment_id', estabId)
      .order('start_date', { ascending: false }),
  ])

  if (!client) notFound()

  const typedClient = client as Client
  const typedDocs = (documents as Document[]) || []
  const typedAdoptions = (adoptions as unknown as AdoptionRow[]) || []
  const typedFosters = (fosters as unknown as FosterRow[]) || []

  // Donations : lien direct via client_id (les anciennes lignes ont été
  // backfillées par migration 20260506e). On évite ainsi le matching par
  // email qui contaminait les fiches de couples partageant la même adresse.
  const { data: dons } = await admin
    .from('donations')
    .select('id, amount, date, payment_method, cerfa_number, cerfa_generated, source, notes')
    .eq('establishment_id', estabId)
    .eq('client_id', id)
    .order('date', { ascending: false })
  const typedDonations = (dons as DonationRow[]) || []

  const totalCA = typedDocs
    .filter((d) => d.type === 'facture' && d.status === 'paid')
    .reduce((sum, d) => sum + d.total, 0)
  const totalDonated = typedDonations.reduce((s, d) => s + Number(d.amount), 0)

  const canEditClients = ctx!.permissions.canManageClients

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/clients" className="text-muted hover:text-text transition-colors">
          &larr; Retour
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{typedClient.name}</h1>
          <p className="text-sm text-muted mt-1">Fiche contact</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Colonne gauche : carte contact + stats + edit */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-surface rounded-xl border border-border p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-xl font-bold text-white">
                {typedClient.name[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{typedClient.name}</h3>
                <div className="flex flex-wrap gap-1 mt-1">
                  {typedClient.is_adopter && (
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/15 text-primary">
                      Adoptant
                    </span>
                  )}
                  {typedClient.is_foster && (
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      Famille d’accueil
                    </span>
                  )}
                  {typedClient.is_member && (
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-green-500/15 text-green-600 dark:text-green-400">
                      Adhérent
                    </span>
                  )}
                  {!typedClient.is_adopter && !typedClient.is_foster && !typedClient.is_member && (
                    <span className="text-[10px] text-muted">Sans étiquette</span>
                  )}
                </div>
                {typedClient.is_member && typedClient.member_since && (
                  <p className="text-[11px] text-muted mt-1">
                    Adhérent depuis le {formatDateShort(typedClient.member_since)}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {typedClient.email && <p className="text-muted">{typedClient.email}</p>}
              {typedClient.phone && <p className="text-muted">{typedClient.phone}</p>}
              {typedClient.address && (
                <p className="text-muted">
                  {typedClient.address}<br />
                  {typedClient.postal_code} {typedClient.city}
                </p>
              )}
              {typedClient.notes && (
                <p className="text-muted mt-3 p-2 bg-surface-dark rounded-lg text-xs">
                  {typedClient.notes}
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <Stat value={typedAdoptions.length} label="Adoptions" />
            <Stat value={typedFosters.length} label="Placements FA" />
            <Stat value={typedDonations.length} label="Dons" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat value={formatCurrency(totalCA)} label="CA payé" tone="success" />
            <Stat value={formatCurrency(totalDonated)} label="Total dons" tone="success" />
          </div>

          {canEditClients && (
            <details className="bg-surface rounded-xl border border-border">
              <summary className="p-4 cursor-pointer text-sm font-medium text-muted hover:text-text transition-colors">
                Modifier le contact
              </summary>
              <div className="px-4 pb-4">
                <ClientForm client={typedClient} />
              </div>
            </details>
          )}
        </div>

        {/* Colonne droite : historique */}
        <div className="lg:col-span-2 space-y-6">
          {/* Adoptions */}
          {typedAdoptions.length > 0 && (
            <Section title="Adoptions" count={typedAdoptions.length}>
              <ul className="divide-y divide-border">
                {typedAdoptions.map((a) => (
                  <li key={a.id} className="px-5 py-3 flex items-center gap-3 hover:bg-surface-hover/30">
                    <span className="text-2xl">
                      {a.animal?.species === 'cat' ? '🐱' : a.animal?.species === 'dog' ? '🐶' : '🐾'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={a.animal?.id ? `/animals/${a.animal.id}` : '#'}
                        className="font-semibold hover:text-primary"
                      >
                        {a.animal?.name ?? '—'}
                      </Link>
                      <div className="text-xs text-muted">
                        Contrat {a.contract_number} · adopté le {formatDateShort(a.adoption_date)}
                        {a.adoption_fee ? ` · ${formatCurrency(Number(a.adoption_fee))}` : ''}
                      </div>
                    </div>
                    <SignatureBadge sig={a.signature_status} status={a.status} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Placements FA */}
          {typedFosters.length > 0 && (
            <Section title="Placements en famille d’accueil" count={typedFosters.length}>
              <ul className="divide-y divide-border">
                {typedFosters.map((f) => {
                  const ongoing = !f.actual_end_date
                  return (
                    <li key={f.id} className="px-5 py-3 flex items-center gap-3 hover:bg-surface-hover/30">
                      <span className="text-2xl">
                        {f.animal?.species === 'cat' ? '🐱' : f.animal?.species === 'dog' ? '🐶' : '🐾'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={f.animal?.id ? `/animals/${f.animal.id}` : '#'}
                          className="font-semibold hover:text-primary"
                        >
                          {f.animal?.name ?? '—'}
                        </Link>
                        <div className="text-xs text-muted">
                          Contrat {f.contract_number} · du {formatDateShort(f.start_date)}
                          {' au '}
                          {f.actual_end_date
                            ? formatDateShort(f.actual_end_date)
                            : f.expected_end_date
                              ? `${formatDateShort(f.expected_end_date)} (prévu)`
                              : '—'}
                        </div>
                      </div>
                      {ongoing ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          En cours
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-muted/15 text-muted">
                          Terminé
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}

          {/* Documents (factures) */}
          <Section title="Documents" count={typedDocs.length}>
            {typedDocs.length === 0 ? (
              <p className="px-5 py-5 text-sm text-muted text-center">Aucun document pour ce contact</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-hover/50">
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Numéro</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Date</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Total</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Statut</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {typedDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-surface-hover/30 transition-colors">
                        <td className="px-4 py-3"><TypeBadge type={doc.type} /></td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/documents/${doc.id}`}
                            className="font-medium hover:text-primary"
                          >
                            {doc.numero}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted">{formatDateShort(doc.date)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(doc.total)}</td>
                        <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/documents/${doc.id}`}
                              className="px-2 py-1 rounded text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                            >
                              Ouvrir
                            </Link>
                            <a
                              href={`/api/pdf/${doc.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded text-xs font-medium bg-muted/15 text-muted hover:bg-muted/25 transition-colors"
                            >
                              PDF
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Dons / Reçus fiscaux */}
          {typedDonations.length > 0 && (
            <Section title="Dons & reçus fiscaux" count={typedDonations.length}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-hover/50">
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">N° CERFA</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Source</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Montant</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Reçu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {typedDonations.map((d) => (
                      <tr key={d.id} className="hover:bg-surface-hover/30 transition-colors">
                        <td className="px-4 py-3 text-muted">{formatDateShort(d.date)}</td>
                        <td className="px-4 py-3 font-medium">{d.cerfa_number ?? '—'}</td>
                        <td className="px-4 py-3 text-muted text-xs uppercase">{d.source ?? 'manual'}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(d.amount))}</td>
                        <td className="px-4 py-3 text-right">
                          {d.cerfa_generated ? (
                            <a
                              href={`/api/pdf/cerfa/${d.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded text-xs font-medium bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/25 transition-colors"
                            >
                              Voir PDF
                            </a>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        {typeof count === 'number' && (
          <span className="text-xs text-muted">{count}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string | number
  label: string
  tone?: 'success'
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-3 text-center">
      <p className={`text-lg font-bold ${tone === 'success' ? 'text-success' : ''}`}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  )
}

function SignatureBadge({ sig, status }: { sig: string | null; status: string }) {
  if (status === 'cancelled') {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-muted/15 text-muted">
        Annulé
      </span>
    )
  }
  if (sig === 'signed' || status === 'active') {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-green-500/15 text-green-600 dark:text-green-400">
        Signé
      </span>
    )
  }
  if (sig === 'pending') {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
        En attente signature
      </span>
    )
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-muted/15 text-muted">
      Brouillon
    </span>
  )
}
