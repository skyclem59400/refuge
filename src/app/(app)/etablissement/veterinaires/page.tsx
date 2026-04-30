import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Stethoscope } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getVeterinaryClinics } from '@/lib/actions/veterinarians'
import { VeterinariansClient } from '@/components/veterinarians/veterinarians-client'

export default async function VeterinariansPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx) return null

  const { canManageEstablishment, canManageVeterinarians, isAdmin, isOwner } = ctx.permissions
  // Restrict to admins / owners / managers + porteurs de manage_veterinarians
  if (!canManageEstablishment && !canManageVeterinarians && !isAdmin && !isOwner) {
    redirect('/dashboard')
  }

  const result = await getVeterinaryClinics(false)
  const clinics = result.data || []

  return (
    <div className="animate-fade-up max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/etablissement" className="text-muted hover:text-text transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Stethoscope className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Cabinets et veterinaires</h1>
        </div>
      </div>

      <p className="text-sm text-muted mb-6 max-w-2xl">
        Gerez les cabinets / cliniques veterinaires partenaires et les praticiens qui y exercent.
        Lors de l’ajout d’un acte de sante ou de l’identification d’un animal, vous selectionnerez
        un praticien dans cette liste.
      </p>

      <VeterinariansClient clinics={clinics} />
    </div>
  )
}
