'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Settings, Loader2, Wifi, Key, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { syncRingoverCalls, saveAccueilNumber } from '@/lib/actions/ringover-sync'
import { saveRingoverConnection, getRingoverNumbers, disconnectRingover } from '@/lib/actions/ringover'
import type { RingoverConnection, RingoverNumber } from '@/lib/types/database'

interface SyncControlsProps {
  connection: RingoverConnection | null
}

export function SyncControls({ connection }: SyncControlsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [numbers, setNumbers] = useState<RingoverNumber[]>([])
  const [selectedNumber, setSelectedNumber] = useState('')
  const [showConfig, setShowConfig] = useState(false)

  // ── State 1: No connection at all → API key form ──
  if (!connection) {
    return (
      <div className="bg-surface rounded-xl border border-border p-6 space-y-4 max-w-lg mx-auto">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Key className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-base font-semibold">Connecter Ringover</h3>
          <p className="text-xs text-muted mt-1">
            Entrez votre cle API Ringover pour activer le suivi des appels d&apos;accueil
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted block mb-1.5">Cle API Ringover</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Votre cle API..."
              className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                placeholder:text-muted/50"
            />
            <p className="text-[11px] text-muted mt-1">
              Disponible dans Ringover Dashboard &gt; Parametres &gt; API
            </p>
          </div>

          <button
            onClick={() => {
              if (!apiKey.trim()) return
              setPendingAction('connect')
              startTransition(async () => {
                const r = await saveRingoverConnection({ api_key: apiKey.trim() })
                if (r.error) {
                  toast.error(r.error)
                } else {
                  toast.success('Ringover connecte avec succes')
                  router.refresh()
                }
                setPendingAction(null)
              })
            }}
            disabled={isPending || !apiKey.trim()}
            className="w-full px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold
              hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              inline-flex items-center justify-center gap-2"
          >
            {pendingAction === 'connect' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wifi className="w-4 h-4" />
            )}
            Connecter
          </button>
        </div>
      </div>
    )
  }

  // ── State 2: Connected but no accueil number → number selection ──
  if (!connection.accueil_number) {
    return (
      <div className="bg-surface rounded-xl border border-primary/20 p-6 space-y-4 max-w-lg mx-auto">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-2">
            <Check className="w-5 h-5 text-success" />
          </div>
          <h3 className="text-base font-semibold">Ringover connecte</h3>
          <p className="text-xs text-muted mt-1">
            Selectionnez le numero d&apos;accueil a suivre pour activer le dashboard
          </p>
        </div>

        {numbers.length === 0 ? (
          <button
            onClick={() => {
              setPendingAction('load')
              startTransition(async () => {
                const r = await getRingoverNumbers()
                if (r.error) toast.error(r.error)
                else setNumbers(r.data || [])
                setPendingAction(null)
              })
            }}
            disabled={isPending}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
              bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {pendingAction === 'load' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
            Charger les numeros disponibles
          </button>
        ) : (
          <div className="space-y-3">
            <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
              {numbers.map((num) => (
                <label
                  key={num.number}
                  className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                    selectedNumber === num.number
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-surface-hover border border-transparent'
                  }`}
                >
                  <input
                    type="radio"
                    name="accueil"
                    value={num.number}
                    checked={selectedNumber === num.number}
                    onChange={(e) => setSelectedNumber(e.target.value)}
                    className="accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium">{num.label || num.number}</p>
                    <p className="text-xs text-muted">{num.number}</p>
                  </div>
                </label>
              ))}
            </div>
            <button
              onClick={() => {
                const chosen = numbers.find((n) => n.number === selectedNumber)
                setPendingAction('save')
                startTransition(async () => {
                  const r = await saveAccueilNumber({
                    accueil_number: selectedNumber,
                    accueil_label: chosen?.label,
                  })
                  if (r.error) toast.error(r.error)
                  else {
                    toast.success("Numero d'accueil configure")
                    router.refresh()
                  }
                  setPendingAction(null)
                })
              }}
              disabled={isPending || !selectedNumber}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium
                hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {pendingAction === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Valider ce numero'}
            </button>
          </div>
        )}

        <button
          onClick={() => {
            setPendingAction('disconnect')
            startTransition(async () => {
              await disconnectRingover()
              toast.success('Ringover deconnecte')
              router.refresh()
              setPendingAction(null)
            })
          }}
          disabled={isPending}
          className="w-full text-xs text-muted hover:text-error transition-colors text-center"
        >
          Deconnecter Ringover
        </button>
      </div>
    )
  }

  // ── State 3: Fully configured → sync controls + config panel ──
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-xs text-muted">
          <span className="font-medium">{connection.accueil_label || connection.accueil_number}</span>
          {connection.last_sync_at && (
            <span className="ml-2">
              Sync: {new Date(connection.last_sync_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            setPendingAction('sync')
            startTransition(async () => {
              const r = await syncRingoverCalls()
              if (r.error) toast.error(r.error)
              else toast.success(`${r.data?.synced || 0} appels synchronises`)
              setPendingAction(null)
              router.refresh()
            })
          }}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary
            text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {pendingAction === 'sync' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Synchroniser
        </button>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface-hover transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {showConfig && (
        <div className="bg-surface-dark rounded-lg border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Configuration Ringover</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Numero accueil</span>
            <span className="font-medium">{connection.accueil_label || connection.accueil_number}</span>
          </div>
          {connection.astreinte_number && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Numero astreinte</span>
              <span className="font-medium">{connection.astreinte_label || connection.astreinte_number}</span>
            </div>
          )}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <button
              onClick={() => {
                setPendingAction('change')
                startTransition(async () => {
                  const r = await saveAccueilNumber({ accueil_number: '', accueil_label: '' })
                  if (!r.error) router.refresh()
                  setPendingAction(null)
                })
              }}
              disabled={isPending}
              className="text-xs text-muted hover:text-primary transition-colors"
            >
              Changer le numero
            </button>
            <span className="text-border">|</span>
            <button
              onClick={() => {
                if (!confirm('Deconnecter Ringover ? Les donnees synchronisees seront conservees.')) return
                setPendingAction('disconnect')
                startTransition(async () => {
                  await disconnectRingover()
                  toast.success('Ringover deconnecte')
                  router.refresh()
                  setPendingAction(null)
                })
              }}
              disabled={isPending}
              className="text-xs text-muted hover:text-error transition-colors inline-flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Deconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
