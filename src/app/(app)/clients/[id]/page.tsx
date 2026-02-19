import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { ClientForm } from '@/components/clients/client-form'
import { TypeBadge, StatusBadge } from '@/components/documents/status-badge'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import type { Client, Document } from '@/lib/types/database'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const admin = createAdminClient()

  const [{ data: client }, { data: documents }] = await Promise.all([
    admin.from('clients').select('*').eq('id', id).eq('establishment_id', estabId).single(),
    admin
      .from('documents')
      .select('*')
      .eq('client_id', id)
      .eq('establishment_id', estabId)
      .order('created_at', { ascending: false }),
  ])

  if (!client) notFound()

  const typedClient = client as Client
  const typedDocs = (documents as Document[]) || []
  const totalCA = typedDocs
    .filter((d) => d.type === 'facture' && d.status === 'paid')
    .reduce((sum, d) => sum + d.total, 0)

  const canEditClients = ctx!.permissions.canManageClients

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/clients" className="text-muted hover:text-text transition-colors">
          &larr; Retour
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{typedClient.name}</h1>
          <p className="text-sm text-muted mt-1">Fiche client</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Client info */}
        <div className="lg:col-span-1 space-y-4">
          {/* Card */}
          <div className="bg-surface rounded-xl border border-border p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-xl font-bold text-white">
                {typedClient.name[0].toUpperCase()}
              </div>
              <div>
                <h3 className="font-semibold">{typedClient.name}</h3>
                {typedClient.type && (
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    typedClient.type === 'organisation'
                      ? 'bg-info/15 text-info'
                      : 'bg-secondary/15 text-secondary'
                  }`}>
                    {typedClient.type === 'organisation' ? 'Organisation' : 'Particulier'}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {typedClient.email && (
                <p className="text-muted">{typedClient.email}</p>
              )}
              {typedClient.phone && (
                <p className="text-muted">{typedClient.phone}</p>
              )}
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
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface rounded-xl border border-border p-4 text-center">
              <p className="text-2xl font-bold">{typedDocs.length}</p>
              <p className="text-xs text-muted">Documents</p>
            </div>
            <div className="bg-surface rounded-xl border border-border p-4 text-center">
              <p className="text-2xl font-bold text-success">{formatCurrency(totalCA)}</p>
              <p className="text-xs text-muted">CA paye</p>
            </div>
          </div>

          {/* Edit form — only if can edit */}
          {canEditClients && (
            <details className="bg-surface rounded-xl border border-border">
              <summary className="p-4 cursor-pointer text-sm font-medium text-muted hover:text-text transition-colors">
                Modifier le client
              </summary>
              <div className="px-4 pb-4">
                <ClientForm client={typedClient} />
              </div>
            </details>
          )}
        </div>

        {/* Documents */}
        <div className="lg:col-span-2">
          <div className="bg-surface rounded-xl border border-border">
            <div className="p-5 border-b border-border">
              <h3 className="font-semibold">Historique des documents</h3>
              <p className="text-xs text-muted mt-1">{typedDocs.length} document(s)</p>
            </div>

            {typedDocs.length === 0 ? (
              <p className="p-5 text-sm text-muted text-center">Aucun document pour ce client</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-hover/50">
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Numero</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Date</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Total</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {typedDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-surface-hover/30 transition-colors">
                        <td className="px-4 py-3"><TypeBadge type={doc.type} /></td>
                        <td className="px-4 py-3 font-medium">{doc.numero}</td>
                        <td className="px-4 py-3 text-muted">{formatDateShort(doc.date)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(doc.total)}</td>
                        <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
