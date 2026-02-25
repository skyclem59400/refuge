'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { syncAnimalsFromHunimalis } from '@/lib/actions/hunimalis-sync'

interface SyncButtonProps {
  lastSyncedAt?: string | null
}

export function HunimalisSyncButton({ lastSyncedAt }: SyncButtonProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; synced?: number; details?: string; error?: string } | null>(null)

  async function handleSync() {
    setLoading(true)
    setResult(null)

    try {
      const res = await syncAnimalsFromHunimalis()
      setResult(res)
    } catch {
      setResult({ error: 'Erreur de connexion' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {/* Sync result message */}
      {result && (
        <span className={`text-xs ${result.error ? 'text-red-400' : 'text-green-400'}`}>
          {result.error
            ? result.error
            : `${result.synced} animaux (${result.details})`}
        </span>
      )}

      {/* Last sync info */}
      {lastSyncedAt && !result && (
        <span className="text-xs text-muted">
          Sync : {new Date(lastSyncedAt).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      )}

      {/* Sync button */}
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
          bg-surface border border-border hover:border-primary/50 hover:bg-surface-dark
          transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="Synchroniser depuis Hunimalis"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Synchronisation...' : 'Rafraichir Hunimalis'}
      </button>
    </div>
  )
}
