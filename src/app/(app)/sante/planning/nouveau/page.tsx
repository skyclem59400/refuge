import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, CalendarDays } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getVeterinaryClinics } from '@/lib/actions/veterinarians'
import { NewVetVisitForm } from '@/components/planning-veto/new-vet-visit-form'

export default async function NewPlanningVetoPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) return null
  if (!ctx.permissions.canManageHealth) redirect('/dashboard')

  const clinicsRes = await getVeterinaryClinics(true)
  const clinics = clinicsRes.data || []

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/sante/planning" className="text-muted hover:text-text">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Nouveau passage vétérinaire</h1>
        </div>
      </div>
      <NewVetVisitForm clinics={clinics} />
    </div>
  )
}
