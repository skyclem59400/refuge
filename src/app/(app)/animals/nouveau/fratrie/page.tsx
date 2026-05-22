import Link from 'next/link'
import { Users } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { SiblingForm } from '@/components/animals/sibling-form'
import type { Box } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export default async function NouvelleFratriePage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) throw new Error('Establishment context required')
  if (!ctx.permissions.canManageAnimals) {
    throw new Error('Permissions insuffisantes')
  }

  const admin = createAdminClient()
  const { data: boxes } = await admin
    .from('boxes')
    .select('*')
    .eq('establishment_id', ctx.establishment.id)
    .order('name')

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/animals/nouveau"
          className="text-muted hover:text-text transition-colors text-sm"
        >
          &larr; Saisie individuelle
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Créer une fratrie</h1>
          <p className="text-sm text-muted mt-1">
            Enregistrer plusieurs animaux d&apos;une portée ou d&apos;une saisie d&apos;un coup. Les
            infos communes (espèce, origine, lieu de récupération…) sont saisies une seule fois,
            puis chaque animal reçoit son nom, sexe et identifiants propres.
          </p>
        </div>
      </div>

      <SiblingForm boxes={(boxes as Box[]) || []} />
    </div>
  )
}
