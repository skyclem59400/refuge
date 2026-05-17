'use client'

import { useState } from 'react'
import { ClientList } from './client-list'
import { TeamMemberList } from './team-member-list'
import { LegacyContactsList } from './legacy-contacts-list'
import type { Client, EstablishmentMember } from '@/lib/types/database'

interface RepertoireTabsProps {
  readonly clients: Client[]
  readonly members: EstablishmentMember[]
  readonly canEdit: boolean
  readonly establishmentId: string
  readonly legacyCount?: number
  readonly legacyConvertedCount?: number
}

type Tab = 'contacts' | 'team' | 'legacy'

export function RepertoireTabs({ clients, members, canEdit, establishmentId, legacyCount, legacyConvertedCount }: RepertoireTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('contacts')

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
        {legacyCount !== undefined && legacyCount > 0 && (
          <button
            onClick={() => setActiveTab('legacy')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'legacy'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-text'
            }`}
            title={legacyConvertedCount !== undefined ? `${legacyConvertedCount} déjà converti(s)` : undefined}
          >
            Archive Hunimalis
            <span className="ml-2 text-xs opacity-70">
              ({legacyCount.toLocaleString('fr-FR')})
            </span>
          </button>
        )}
      </div>

      {/* Content */}
      {activeTab === 'contacts' && (
        <ClientList
          initialData={clients}
          canEdit={canEdit}
          establishmentId={establishmentId}
        />
      )}
      {activeTab === 'team' && <TeamMemberList members={members} />}
      {activeTab === 'legacy' && <LegacyContactsList canEdit={canEdit} />}
    </div>
  )
}
