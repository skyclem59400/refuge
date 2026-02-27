'use client'

import { useEffect, useState } from 'react'
import { Bot } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getAgentStatusLabel } from '@/lib/sda-utils'
import type { AgentSession } from '@/lib/types/database'

interface ActiveAgentsProps {
  initialAgents: AgentSession[]
  establishmentId: string
}

function getStatusDotClass(status: string): string {
  switch (status) {
    case 'in_call':
      return 'bg-green-500 animate-pulse'
    case 'processing':
      return 'bg-amber-500'
    default:
      return 'bg-gray-500'
  }
}

export function ActiveAgents({ initialAgents, establishmentId }: ActiveAgentsProps) {
  const [agents, setAgents] = useState<AgentSession[]>(initialAgents)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('agent-sessions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_sessions',
          filter: `establishment_id=eq.${establishmentId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAgents((prev) => [payload.new as AgentSession, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setAgents((prev) =>
              prev.map((a) => (a.id === (payload.new as AgentSession).id ? (payload.new as AgentSession) : a))
            )
          } else if (payload.eventType === 'DELETE') {
            setAgents((prev) => prev.filter((a) => a.id !== (payload.old as { id: string }).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [establishmentId])

  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">Agents actifs</h3>

      {agents.length === 0 ? (
        <div className="text-center py-4">
          <Bot className="w-8 h-8 text-muted mx-auto mb-2" />
          <p className="text-sm text-muted">Aucun agent actif</p>
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <div key={agent.id} className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface ${getStatusDotClass(agent.status)}`}
                />
              </div>
              <div>
                <p className="text-sm font-medium">{agent.agent_name}</p>
                <p className="text-xs text-muted">{getAgentStatusLabel(agent.status)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
