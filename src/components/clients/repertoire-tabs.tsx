'use client'

import { useState } from 'react'
import { ClientList } from './client-list'
import { TeamMemberList } from './team-member-list'
import type { Client, EstablishmentMember } from '@/lib/types/database'

interface RepertoireTabsProps {
  clients: Client[]
  members: EstablishmentMember[]
  canEdit: boolean
  establishmentId: string
}

export function RepertoireTabs({ clients, members, canEdit, establishmentId }: RepertoireTabsProps) {
  const [activeTab, setActiveTab] = useState<'contacts' | 'team'>('contacts')

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-dark rounded-lg p-1 w-fit border border-border">
        <button
          onClick={() => setActiveTab('contacts')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'contacts'
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted hover:text-text'
          }`}
        >
          Contacts
          <span className="ml-2 text-xs opacity-70">({clients.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'team'
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted hover:text-text'
          }`}
        >
          Equipe
          <span className="ml-2 text-xs opacity-70">({members.length})</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'contacts' ? (
        <ClientList
          initialData={clients}
          canEdit={canEdit}
          establishmentId={establishmentId}
        />
      ) : (
        <TeamMemberList members={members} />
      )}
    </div>
  )
}
