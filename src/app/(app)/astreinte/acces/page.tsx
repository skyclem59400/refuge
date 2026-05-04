import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { AccessControlPanel } from '@/components/astreinte/access-control-panel'

export const dynamic = 'force-dynamic'

export default async function AccessPage() {
  const ctx = await getEstablishmentContext()
  if (!ctx?.permissions.canManageEstablishment) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()

  const [{ data: domains }, { data: emails }, { data: communes }] = await Promise.all([
    admin
      .from('astreinte_authorized_domains')
      .select(
        'domain, scope_type, organization_label, municipality_code_insee, epci_code_siren, active, notes, created_at, validated_at'
      )
      .order('created_at', { ascending: false }),
    admin
      .from('astreinte_authorized_emails')
      .select(
        'email, scope_type, full_name, role, organization_label, municipality_code_insee, active, notes, created_at, validated_at'
      )
      .order('created_at', { ascending: false }),
    admin
      .from('astreinte_municipalities')
      .select('code_insee, name, postal_codes, epci_code_siren')
      .order('name'),
  ])

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Accès au portail astreinte</h1>
        <p className="text-sm text-muted mt-1">
          Gérez la liste blanche des emails &amp; domaines autorisés à se connecter sur{' '}
          <a
            href="https://astreinte.sda-nord.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            astreinte.sda-nord.com
          </a>
          . Aucune validation = aucun accès.
        </p>
      </div>

      <AccessControlPanel
        domains={domains ?? []}
        emails={emails ?? []}
        communes={communes ?? []}
      />
    </div>
  )
}
