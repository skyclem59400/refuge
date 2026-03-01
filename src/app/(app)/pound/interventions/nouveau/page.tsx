import Link from 'next/link'
import { InterventionForm } from '@/components/pound/intervention-form'

export default function NouvelleInterventionPage() {
  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/pound/interventions"
          className="text-muted hover:text-text transition-colors"
        >
          &larr; Retour
        </Link>
        <div>
          <h2 className="text-lg font-bold">Nouvelle intervention</h2>
          <p className="text-sm text-muted mt-0.5">Enregistrer une intervention de fourriere</p>
        </div>
      </div>

      <InterventionForm />
    </div>
  )
}
