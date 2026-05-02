import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, CalendarDays } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getVetVisit } from '@/lib/actions/vet-visits'
import { VetVisitTableClient } from '@/components/planning-veto/vet-visit-table-client'
import type { Animal } from '@/lib/types/database'

export default async function PlanningVetoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getEstablishmentContext()
  if (!ctx) return null
  if (!ctx.permissions.canManageHealth) redirect('/dashboard')

  const { id } = await params
  const res = await getVetVisit(id)
  if (!res.data) notFound()

  const visit = res.data

  // Charger la liste des animaux disponibles (pour ajouter une ligne)
  const admin = createAdminClient()
  const { data: animalsList } = await admin
    .from('animals')
    .select('id, name, medal_number, species, box_id, breed, breed_cross, color, chip_number')
    .eq('establishment_id', ctx.establishment.id)
    .in('status', ['pound', 'shelter', 'foster_family', 'boarding'])
    .order('name')

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/planning-veto" className="text-muted hover:text-text">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <CalendarDays className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold capitalize">
          {new Date(visit.visit_date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
          {visit.time_label ? ` — ${visit.time_label}` : ''}
        </h1>
      </div>

      <VetVisitTableClient
        visit={visit}
        availableAnimals={(animalsList as Pick<Animal, 'id' | 'name' | 'medal_number' | 'species' | 'box_id' | 'breed' | 'breed_cross' | 'color' | 'chip_number'>[]) || []}
      />
    </div>
  )
}
