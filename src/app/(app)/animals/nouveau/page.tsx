import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { AnimalForm } from '@/components/animals/animal-form'
import type { Box } from '@/lib/types/database'

export default async function NouvelAnimalPage() {
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const admin = createAdminClient()

  const { data: boxes } = await admin
    .from('boxes')
    .select('*')
    .eq('establishment_id', estabId)
    .order('name')

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/animals"
          className="text-muted hover:text-text transition-colors"
        >
          &larr; Retour
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nouvel animal</h1>
          <p className="text-sm text-muted mt-1">Enregistrer un nouvel animal en fourriere</p>
        </div>
      </div>

      <AnimalForm boxes={(boxes as Box[]) || []} />
    </div>
  )
}
