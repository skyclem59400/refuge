import { redirect } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import {
  getAnimalNewsByCategory,
  getAnimalsForCategory,
  getMosaics,
} from '@/lib/actions/animal-news'
import { AnimalNewsClient } from '@/components/animal-news/animal-news-client'

export default async function NouvellesPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.permissions.canViewAnimalNews) redirect('/dashboard')

  const [
    shelteredNewsResult,
    alumniNewsResult,
    shelteredAnimalsResult,
    alumniAnimalsResult,
    mosaicsResult,
  ] = await Promise.all([
    getAnimalNewsByCategory({ category: 'sheltered' }),
    getAnimalNewsByCategory({ category: 'alumni' }),
    getAnimalsForCategory('sheltered'),
    getAnimalsForCategory('alumni'),
    getMosaics(),
  ])

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
              Suivi des protégés au refuge et nouvelles des sortis (adoptés / familles d&apos;accueil)
            </p>
          </div>
        </div>
      </div>

      <AnimalNewsClient
        shelteredNews={shelteredNewsResult.data || []}
        alumniNews={alumniNewsResult.data || []}
        shelteredAnimals={shelteredAnimalsResult.data || []}
        alumniAnimals={alumniAnimalsResult.data || []}
        mosaics={mosaicsResult.data || []}
        establishmentId={ctx.establishment.id}
      />
    </div>
  )
}
