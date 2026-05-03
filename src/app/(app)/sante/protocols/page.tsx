import Link from 'next/link'
import { ArrowLeft, ListChecks } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getHealthProtocols } from '@/lib/actions/health-protocols'
import { HealthProtocolsClient } from '@/components/health/health-protocols-client'

export default async function HealthProtocolsPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) {
    return null
  }

  const { canManageHealth } = ctx.permissions
  const result = await getHealthProtocols()
  const protocols = result.data || []

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/sante" className="text-muted hover:text-text transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <ListChecks className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Protocoles de soins</h1>
        </div>
      </div>

      <p className="text-sm text-muted mb-6 max-w-2xl">
        Definissez ici les modeles de suite de soins (vaccinations, antiparasitaires, sterilisations).
        Chaque protocole regroupe plusieurs etapes avec un decalage en jours et une recurrence
        optionnelle. Lors de l’application a un animal, les actes correspondants sont generes
        automatiquement avec leurs rappels calcules.
      </p>

      <HealthProtocolsClient protocols={protocols} canManage={canManageHealth} />
    </div>
  )
}
