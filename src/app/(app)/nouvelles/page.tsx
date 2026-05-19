import { redirect } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import {
  getAnimalNewsInbox,
  getAnimalNewsHistory,
  getEligibleAnimalsForNews,
} from '@/lib/actions/animal-news'
import { AnimalNewsClient } from '@/components/animal-news/animal-news-client'

export default async function NouvellesPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.permissions.canViewAnimalNews) redirect('/dashboard')

  const [inboxResult, historyResult, eligibleResult] = await Promise.all([
    getAnimalNewsInbox(),
    getAnimalNewsHistory(),
    getEligibleAnimalsForNews(),
  ])

  const inbox = inboxResult.data || []
  const history = historyResult.data || { solos: [], mosaics: [] }
  const eligibleAnimals = eligibleResult.data || []

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Nouvelles</h1>
            <p className="text-xs text-muted mt-0.5">
              Photos et messages reçus des familles d&apos;accueil et adoptants
            </p>
          </div>
        </div>
      </div>

      <AnimalNewsClient
        inbox={inbox}
        history={history}
        eligibleAnimals={eligibleAnimals}
        establishmentId={ctx.establishment.id}
      />
    </div>
  )
}
