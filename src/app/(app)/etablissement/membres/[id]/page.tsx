import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, FileSignature, UserCircle } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getMemberDocuments } from '@/lib/actions/member-documents'
import { MemberAvatar } from '@/components/ui/member-avatar'
import { MemberDocumentUpload } from '@/components/employment-docs/member-document-upload'
import { MemberDocumentList } from '@/components/employment-docs/member-document-list'
import type { EstablishmentMember, MemberDocument, PermissionGroup } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  salarie: 'Salarié(e)',
  auto_entrepreneur: 'Auto-entrepreneur',
  benevole: 'Bénévole',
  autre: 'Autre',
}

const ROLE_TYPE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  salarie: 'Salarié(e)',
  benevole: 'Bénévole',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function MemberDetailPage({ params }: PageProps) {
  const { id } = await params
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')

  const isAdmin = ctx.permissions.canManageEstablishment || ctx.permissions.canManagePayslips
  const isSelf = ctx.membership.id === id
  if (!isAdmin && !isSelf) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()

  const { data: rawMember, error: memberErr } = await admin
    .from('establishment_members')
    .select('*')
    .eq('id', id)
    .eq('establishment_id', ctx.establishment.id)
    .single()

  if (memberErr || !rawMember) notFound()

  const member = rawMember as EstablishmentMember
  member.groups = []

  // Enrichir avec full_name/email/avatar depuis auth.users
  if (member.user_id) {
    const { data: usersInfo } = await admin.rpc('get_users_info', { user_ids: [member.user_id] })
    if (usersInfo && Array.isArray(usersInfo) && usersInfo[0]) {
      member.full_name = usersInfo[0].full_name || null
      member.email = usersInfo[0].email || undefined
      member.avatar_url = usersInfo[0].avatar_url || null
    }
  }

  // Charger les groupes du membre (jointure member_groups → permission_groups)
  const { data: memberGroupLinks } = await admin
    .from('member_groups')
    .select('group_id')
    .eq('member_id', member.id)

  if (memberGroupLinks && memberGroupLinks.length > 0) {
    const groupIds = memberGroupLinks.map((l: { group_id: string }) => l.group_id)
    const { data: groups } = await admin
      .from('permission_groups')
      .select('*')
      .in('id', groupIds)
    member.groups = (groups as PermissionGroup[]) || []
  }

  const docsResult = await getMemberDocuments({ memberId: id })
  const documents = (docsResult.data || []) as MemberDocument[]

  const displayName = member.full_name || member.pseudo || member.email || 'Collaborateur'
  const contractLabel = CONTRACT_TYPE_LABELS[member.contract_type] || member.contract_type
  const roleLabel = ROLE_TYPE_LABELS[member.role_type] || member.role_type

  return (
    <div className="animate-fade-up space-y-6">
      {/* Retour */}
      <Link
        href="/etablissement"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-text transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux membres
      </Link>

      {/* En-tête identité */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="flex items-start gap-4">
          <MemberAvatar
            src={member.avatar_url}
            name={displayName}
            size={64}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold truncate">{displayName}</h1>
              {isSelf && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                  Vous
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted flex-wrap">
              {member.email && <span>{member.email}</span>}
              {member.pseudo && !member.email && <span>@{member.pseudo}</span>}
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400">
                <UserCircle className="w-3 h-3" />
                {roleLabel}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-dark text-text border border-border">
                {contractLabel}
              </span>
              {(member.groups || []).map((g) => (
                <span
                  key={g.id}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    g.is_system
                      ? 'bg-primary/15 text-primary'
                      : 'bg-surface-dark text-text border border-border'
                  }`}
                >
                  {g.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Contrats & documents RH */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileSignature className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Contrats &amp; documents RH</h2>
            <p className="text-sm text-muted mt-0.5">
              {isSelf
                ? 'Votre contrat de travail, avenants et autres documents.'
                : `Contrats et documents administratifs de ${displayName}.`}
            </p>
          </div>
        </div>

        {ctx.permissions.canManagePayslips && (
          <div className="mb-6 pb-6 border-b border-border">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
              Importer un document
            </h3>
            <MemberDocumentUpload members={[member]} lockedMemberId={member.id} />
          </div>
        )}

        <MemberDocumentList
          documents={documents}
          canDelete={ctx.permissions.canManagePayslips}
        />
      </div>
    </div>
  )
}
