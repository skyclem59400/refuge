'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ExternalLink, Loader2, Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react'
import {
  saveHelloAssoConnection,
  disconnectHelloAsso,
  syncHelloAssoDonations,
} from '@/lib/actions/helloasso'
import type { HelloAssoConnection } from '@/lib/types/database'

interface HelloAssoSettingsProps {
  connection: HelloAssoConnection | null
  canManage: boolean
}

export function HelloAssoSettings({ connection, canManage }: HelloAssoSettingsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  // Form state (only used when not connected)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [organizationSlug, setOrganizationSlug] = useState('')

  function handleConnect() {
    if (!clientId || !clientSecret || !organizationSlug) {
      toast.error('Veuillez remplir tous les champs')
      return
    }

    setPendingAction('connect')
    startTransition(async () => {
      const result = await saveHelloAssoConnection({
        client_id: clientId,
        client_secret: clientSecret,
        organization_slug: organizationSlug,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Connexion HelloAsso enregistree')
        setClientId('')
        setClientSecret('')
        setOrganizationSlug('')
        router.refresh()
      }
      setPendingAction(null)
    })
  }

  function handleSync() {
    setPendingAction('sync')
    startTransition(async () => {
      const result = await syncHelloAssoDonations()
      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        toast.success(`Synchronisation terminee : ${result.data.imported} importes, ${result.data.skipped} deja presents`)
        router.refresh()
      }
      setPendingAction(null)
    })
  }

  function handleDisconnect() {
    if (!confirm('Deconnecter HelloAsso ? Les dons deja synchronises seront conserves.')) return

    setPendingAction('disconnect')
    startTransition(async () => {
      const result = await disconnectHelloAsso()
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('HelloAsso deconnecte')
        router.refresh()
      }
      setPendingAction(null)
    })
  }

  function formatLastSync(date: string | null): string {
    if (!date) return 'Jamais'
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const isSyncing = connection?.sync_status === 'syncing' || pendingAction === 'sync'

  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${connection?.is_active ? 'bg-success/10' : 'bg-warning/10'}`}>
            {connection?.is_active ? (
              <Wifi className="w-5 h-5 text-success" />
            ) : (
              <WifiOff className="w-5 h-5 text-warning" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">HelloAsso</h3>
              <ExternalLink className="w-3.5 h-3.5 text-muted" />
            </div>
            <p className="text-xs text-muted">
              Synchronisation automatique des dons en ligne
            </p>
          </div>
        </div>

        {connection?.is_active && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/15 text-success">
            Connecte
          </span>
        )}
      </div>

      {/* Connected state */}
      {connection?.is_active ? (
        <div className="space-y-4">
          {/* Connection info */}
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted">Organisation :</span>{' '}
              <span className="font-medium">{connection.organization_slug}</span>
            </div>
            <div>
              <span className="text-muted">Derniere synchro :</span>{' '}
              <span className="font-medium">{formatLastSync(connection.last_sync_at)}</span>
            </div>
          </div>

          {/* Sync error */}
          {connection.sync_error && (
            <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-error/10 text-error">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{connection.sync_error}</span>
            </div>
          )}

          {/* Actions */}
          {canManage && (
            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <button
                onClick={handleSync}
                disabled={isPending || isSyncing}
                className="inline-flex items-center gap-2 gradient-primary text-white rounded-lg px-4 py-2 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {isSyncing ? 'Synchronisation...' : 'Synchroniser maintenant'}
              </button>

              <button
                onClick={handleDisconnect}
                disabled={isPending && pendingAction === 'disconnect'}
                className="px-4 py-2 rounded-lg border border-error/30 text-error text-sm hover:bg-error/10 transition-colors disabled:opacity-50"
              >
                {pendingAction === 'disconnect' ? 'Deconnexion...' : 'Deconnecter'}
              </button>
            </div>
          )}
        </div>
      ) : canManage ? (
        /* Not connected - show form */
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Client ID *
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Votre Client ID HelloAsso"
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Client Secret *
            </label>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Votre Client Secret HelloAsso"
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Slug de l&apos;organisation *
            </label>
            <input
              type="text"
              value={organizationSlug}
              onChange={(e) => setOrganizationSlug(e.target.value)}
              placeholder="Ex: mon-association (depuis l'URL HelloAsso)"
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-muted mt-1">
              Le slug se trouve dans l&apos;URL de votre page HelloAsso : helloasso.com/associations/<strong>votre-slug</strong>
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleConnect}
              disabled={isPending || !clientId || !clientSecret || !organizationSlug}
              className="gradient-primary text-white rounded-lg px-4 py-2 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {pendingAction === 'connect' ? 'Connexion...' : 'Connecter'}
            </button>
          </div>
        </div>
      ) : (
        /* Not connected and can't manage */
        <p className="text-sm text-muted">
          HelloAsso n&apos;est pas configure. Contactez un administrateur pour activer la synchronisation.
        </p>
      )}
    </div>
  )
}
