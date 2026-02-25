import Link from 'next/link'
import { PawPrint, Plus } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { AnimalList } from '@/components/animals/animal-list'
import { HunimalisSyncButton } from '@/components/animals/hunimalis-sync-button'
import type { Animal, AnimalPhoto } from '@/lib/types/database'

type AnimalWithPhotos = Animal & { animal_photos: AnimalPhoto[] }

export default async function AnimalsPage() {
  const ctx = await getEstablishmentContext()
  const estabId = ctx!.establishment.id
  const admin = createAdminClient()

  const { data: animals } = await admin
    .from('animals')
    .select('*, animal_photos(*)')
    .eq('establishment_id', estabId)
    .order('name')

  const animalList = (animals as AnimalWithPhotos[]) || []

  // Get last sync date from any synced animal
  const lastSynced = animalList
    .filter((a) => a.last_synced_at)
    .sort((a, b) => new Date(b.last_synced_at!).getTime() - new Date(a.last_synced_at!).getTime())[0]
    ?.last_synced_at || null

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <PawPrint className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Animaux</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {ctx!.permissions.canManageAnimals && ctx!.establishment.name === 'SDA' && (
            <HunimalisSyncButton lastSyncedAt={lastSynced} />
          )}
          {ctx!.permissions.canManageAnimals && (
            <Link
              href="/animals/nouveau"
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"
            >
              <Plus className="w-4 h-4" />
              Nouvel animal
            </Link>
          )}
        </div>
      </div>

      <AnimalList animals={animalList} />
    </div>
  )
}
