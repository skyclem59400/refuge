'use client'

import type { EstablishmentMember } from '@/lib/types/database'

interface TeamMemberListProps {
  members: EstablishmentMember[]
}

function getGroupLabel(member: EstablishmentMember): string {
  if (!member.groups || member.groups.length === 0) return 'Aucun groupe'
  return member.groups.map(g => g.name).join(', ')
}

function isAdmin(member: EstablishmentMember): boolean {
  return (member.groups || []).some(g => g.is_system && g.name === 'Administrateur')
}

export function TeamMemberList({ members }: TeamMemberListProps) {
  if (members.length === 0) {
    return (
      <div className="text-center py-8 text-muted">
        Aucun membre dans l&apos;equipe
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-hover/50">
            <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Membre</th>
            <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Email</th>
            <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Groupes</th>
            <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Depuis</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {members.map((member) => (
            <tr key={member.id} className="hover:bg-surface-hover/30 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {member.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.avatar_url}
                      alt={member.full_name || ''}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {(member.full_name || member.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium">
                    {member.full_name || member.email || 'Utilisateur'}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-muted">{member.email || '-'}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {(member.groups || []).map((group) => (
                    <span
                      key={group.id}
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium
                        ${group.is_system
                          ? 'bg-warning/15 text-warning'
                          : 'bg-primary/15 text-primary'
                        }`}
                    >
                      {group.name}
                    </span>
                  ))}
                  {(!member.groups || member.groups.length === 0) && (
                    <span className="text-xs text-muted italic">Aucun groupe</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-muted">
                {new Date(member.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
