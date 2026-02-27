'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle, AlertCircle, ChevronDown, ChevronUp, Wifi, WifiOff } from 'lucide-react'
import { saveMetaConnection, deleteMetaConnection } from '@/lib/actions/meta-connection'
import type { MetaConnection } from '@/lib/types/database'

interface MetaConnectionSettingsProps {
  connection: MetaConnection | null
}

export function MetaConnectionSettings({ connection }: MetaConnectionSettingsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form state
  const [pageId, setPageId] = useState(connection?.facebook_page_id || '')
  const [pageName, setPageName] = useState(connection?.facebook_page_name || '')
  const [accessToken, setAccessToken] = useState(connection?.facebook_page_access_token || '')
  const [igAccountId, setIgAccountId] = useState(connection?.instagram_business_account_id || '')

  // UI state
  const [showInstructions, setShowInstructions] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  async function handleTestConnection() {
    if (!pageId || !accessToken) {
      toast.error('Veuillez remplir le Page ID et l\'Access Token')
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/meta/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_id: pageId,
          access_token: accessToken,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setTestResult({ success: true, message: data.message || 'Connexion reussie' })
        if (data.page_name) setPageName(data.page_name)
      } else {
        setTestResult({ success: false, message: data.error || 'Echec de la connexion' })
      }
    } catch {
      setTestResult({ success: false, message: 'Erreur reseau. Verifiez votre connexion.' })
    } finally {
      setIsTesting(false)
    }
  }

  function handleSave() {
    if (!pageId || !pageName || !accessToken) {
      toast.error('Veuillez remplir les champs obligatoires (Page ID, Nom, Access Token)')
      return
    }

    startTransition(async () => {
      const result = await saveMetaConnection({
        facebook_page_id: pageId,
        facebook_page_name: pageName,
        facebook_page_access_token: accessToken,
        instagram_business_account_id: igAccountId || null,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Connexion Meta enregistree')
        router.refresh()
      }
    })
  }

  function handleDisconnect() {
    if (!confirm('Deconnecter le compte Meta ? Les publications programmees ne seront plus publiees automatiquement.')) return

    startTransition(async () => {
      const result = await deleteMetaConnection()
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Compte Meta deconnecte')
        setPageId('')
        setPageName('')
        setAccessToken('')
        setIgAccountId('')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Connection status */}
      {connection ? (
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Wifi className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="font-semibold">Connecte</p>
                <p className="text-sm text-muted">Page : {connection.facebook_page_name}</p>
                {connection.instagram_business_account_id && (
                  <p className="text-xs text-muted">Instagram : {connection.instagram_business_account_id}</p>
                )}
              </div>
            </div>
            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-success/15 text-success">
              Actif
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <button
              onClick={handleDisconnect}
              disabled={isPending}
              className="px-4 py-2 rounded-lg border border-error/30 text-error text-sm hover:bg-error/10 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Deconnexion...' : 'Deconnecter'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <WifiOff className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="font-semibold">Non connecte</p>
              <p className="text-sm text-muted">Configurez votre connexion Meta pour publier sur Facebook et Instagram</p>
            </div>
          </div>
        </div>
      )}

      {/* Instructions accordion */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-hover transition-colors"
        >
          <span className="font-semibold text-sm">Comment obtenir les identifiants Meta ?</span>
          {showInstructions ? (
            <ChevronUp className="w-4 h-4 text-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted" />
          )}
        </button>

        {showInstructions && (
          <div className="px-5 pb-5 space-y-4 text-sm text-muted">
            <div>
              <p className="font-semibold text-text mb-1">1. Creer une Facebook App</p>
              <p>Rendez-vous sur <span className="text-primary">developers.facebook.com</span> et creez une application de type &quot;Business&quot;. Ajoutez les produits &quot;Facebook Login&quot; et &quot;Pages API&quot;.</p>
            </div>
            <div>
              <p className="font-semibold text-text mb-1">2. Obtenir un Page Access Token longue duree</p>
              <p>Dans le Graph API Explorer, selectionnez votre application et votre page. Generez un token avec les permissions <code className="bg-surface-hover px-1 rounded">pages_manage_posts</code>, <code className="bg-surface-hover px-1 rounded">pages_read_engagement</code>. Echangez-le ensuite contre un token longue duree via l&apos;endpoint <code className="bg-surface-hover px-1 rounded">/oauth/access_token</code>.</p>
            </div>
            <div>
              <p className="font-semibold text-text mb-1">3. Trouver l&apos;Instagram Business Account ID</p>
              <p>Si votre page Facebook est liee a un compte Instagram professionnel, utilisez le Graph API : <code className="bg-surface-hover px-1 rounded">GET /PAGE_ID?fields=instagram_business_account</code>. L&apos;ID sera dans la reponse.</p>
            </div>
          </div>
        )}
      </div>

      {/* Configuration form */}
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <h3 className="font-semibold">Configuration</h3>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Page ID *
          </label>
          <input
            type="text"
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
            placeholder="Ex: 123456789012345"
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Nom de la page *
          </label>
          <input
            type="text"
            value={pageName}
            onChange={(e) => setPageName(e.target.value)}
            placeholder="Ex: SDA Estormel"
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Access Token *
          </label>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Page Access Token longue duree"
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Instagram Business Account ID (optionnel)
          </label>
          <input
            type="text"
            value={igAccountId}
            onChange={(e) => setIgAccountId(e.target.value)}
            placeholder="Ex: 17841400000000000"
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            testResult.success ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
          }`}>
            {testResult.success ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            {testResult.message}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleTestConnection}
            disabled={isTesting || !pageId || !accessToken}
            className="px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            {isTesting ? 'Test en cours...' : 'Tester la connexion'}
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || !pageId || !pageName || !accessToken}
            className="gradient-primary hover:opacity-90 transition-opacity text-white px-6 py-2 rounded-lg font-semibold text-sm disabled:opacity-50"
          >
            {isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
