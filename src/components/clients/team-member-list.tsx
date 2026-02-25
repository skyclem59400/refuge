'use client'

import type { EstablishmentMember } from '@/lib/types/database'

interface TeamMemberListProps {
  members: EstablishmentMember[]
}

function getRoleLabel(role: string): string {
  return role === 'admin' ? 'Administrateur' : 'Membre'
}

function getRoleColor(role: string): string {
  return role === 'admin'
    ? 'bg-warning/15 text-warning'
    : 'bg-primary/15 text-primary'
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
            <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Role</th>
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
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(member.role)}`}>
                  {getRoleLabel(member.role)}
                </span>
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
