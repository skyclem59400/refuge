import { redirect } from 'next/navigation'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { EstablishmentTabs, type EstablishmentTab } from '@/components/establishment/establishment-tabs'

export default async function EtablissementLayout({
  children,
}: {
  readonly children: React.ReactNode
}) {
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')

  const { canManageEstablishment, canManageVeterinarians, isAdmin, isOwner, canManageLeaves } = ctx.permissions

  if (!canManageEstablishment && !canManageVeterinarians && !isAdmin && !isOwner) {
    redirect('/dashboard')
  }

  const tabs: EstablishmentTab[] = [
    { href: '/etablissement', label: 'Établissement', show: canManageEstablishment || isAdmin || isOwner },
    { href: '/admin/cra/saisie', label: 'CRA', show: canManageLeaves || isAdmin },
    { href: '/etablissement/audit-quotidien', label: 'Audit', show: isAdmin, badge: 'IA' },
    { href: '/etablissement/logs', label: 'Logs', show: isAdmin },
    { href: '/etablissement/veterinaires', label: 'Vétérinaires', show: canManageEstablishment || canManageVeterinarians || isAdmin || isOwner },
    { href: '/etablissement/liste-noire', label: 'Liste noire', show: canManageEstablishment || isAdmin },
  ]

  return (
    <div className="space-y-6">
      <EstablishmentTabs tabs={tabs.filter((t) => t.show)} />
      {children}
    </div>
  )
}
