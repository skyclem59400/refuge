import Link from 'next/link'
import { Users } from 'lucide-react'
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
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Nouvel animal</h1>
          <p className="text-sm text-muted mt-1">Enregistrer un nouvel animal en fourriere</p>
        </div>
        <Link
          href="/animals/nouveau/fratrie"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          title="Saisir plusieurs animaux d'une portée ou d'une saisie en une seule fois"
        >
          <Users className="w-4 h-4" />
          Plusieurs animaux d&apos;un coup
        </Link>
      </div>

      <AnimalForm boxes={(boxes as Box[]) || []} />
    </div>
  )
}
