import Link from 'next/link'
import { ClientForm } from '@/components/clients/client-form'

export default function NouveauClientPage() {
  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/clients"
          className="text-muted hover:text-text transition-colors"
        >
          ← Retour
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nouveau client</h1>
          <p className="text-sm text-muted mt-1">Ajouter un client a votre base</p>
        </div>
      </div>

      <ClientForm />
    </div>
  )
}
