'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Settings, Loader2, Wifi, Key, X, Phone, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { syncRingoverCalls, saveAccueilNumber } from '@/lib/actions/ringover-sync'
import { saveRingoverConnection, disconnectRingover, getRingoverIVRNumbers } from '@/lib/actions/ringover'
import type { RingoverConnection, RingoverNumber } from '@/lib/types/database'

interface SyncControlsProps {
  connection: RingoverConnection | null
}

export function SyncControls({ connection }: SyncControlsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const [showNumberPicker, setShowNumberPicker] = useState(false)
  const [availableNumbers, setAvailableNumbers] = useState<RingoverNumber[]>([])
  const [loadingNumbers, setLoadingNumbers] = useState(false)
  const [manualNumber, setManualNumber] = useState('')

  // ── Fetch available numbers from Ringover ──
  async function fetchNumbers() {
    setLoadingNumbers(true)
    const result = await getRingoverIVRNumbers()
    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      setAvailableNumbers(result.data)
      if (result.data.length === 0) {
        toast.info('Aucun numero IVR trouve. Vous pouvez saisir le numero manuellement.')
      }
    }
    setLoadingNumbers(false)
  }

  // ── Save accueil number and trigger sync ──
  function handleSelectNumber(number: string, label: string) {
    setPendingAction('save-number')
    startTransition(async () => {
      const r = await saveAccueilNumber({
        accueil_number: number,
        accueil_label: label,
      })
      if (r.error) {
        toast.error(r.error)
      } else {
        toast.success(`Numero d'accueil configure : ${label || number}`)
        // Auto-sync after setting number
        const syncResult = await syncRingoverCalls()
        if (syncResult.error) {
          toast.error(syncResult.error, { duration: 15000 })
        } else {
          toast.success(`${syncResult.data?.synced || 0} appels synchronises`)
        }
        router.refresh()
      }
      setPendingAction(null)
      setShowNumberPicker(false)
    })
  }

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

  // ── State 2: Connected → sync controls + config panel + number picker ──
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-xs text-muted">
          {connection.accueil_number ? (
            <>
              <span className="font-medium">{connection.accueil_label || connection.accueil_number}</span>
              {connection.last_sync_at && (
                <span className="ml-2">
                  Sync: {new Date(connection.last_sync_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </>
          ) : (
            <button
              onClick={() => {
                setShowNumberPicker(true)
                if (availableNumbers.length === 0) fetchNumbers()
              }}
              className="inline-flex items-center gap-1.5 text-primary font-medium hover:text-primary-dark transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              Configurer le numero d&apos;accueil
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
        </div>
        <button
          onClick={() => {
            setPendingAction('sync')
            startTransition(async () => {
              const r = await syncRingoverCalls()
              if (r.error) toast.error(r.error, { duration: 15000 })
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

      {/* ── Number picker panel ── */}
      {showNumberPicker && (
        <div className="bg-surface rounded-xl border border-primary/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Choisir le numero d&apos;accueil</p>
            <button onClick={() => setShowNumberPicker(false)} className="p-1 text-muted hover:text-text">
              <X className="w-4 h-4" />
            </button>
          </div>

          {loadingNumbers ? (
            <div className="flex items-center gap-2 text-xs text-muted py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Chargement des numeros Ringover...
            </div>
          ) : availableNumbers.length > 0 ? (
            <div className="space-y-1.5">
              {availableNumbers.map((num) => (
                <button
                  key={num.number}
                  onClick={() => handleSelectNumber(num.number, num.label)}
                  disabled={isPending}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg
                    bg-surface-dark hover:bg-primary/10 border border-border hover:border-primary/30
                    transition-colors text-left disabled:opacity-50"
                >
                  <div>
                    <span className="text-sm font-medium">{num.label}</span>
                    <span className="text-xs text-muted ml-2">{num.number}</span>
                  </div>
                  <span className="text-[10px] text-muted uppercase">{num.type}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">Aucun numero detecte automatiquement.</p>
          )}

          {/* Manual input */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted mb-1.5">Ou saisir manuellement :</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualNumber}
                onChange={(e) => setManualNumber(e.target.value)}
                placeholder="Ex: +33327786256"
                className="flex-1 px-3 py-1.5 bg-surface-dark border border-border rounded-lg text-sm
                  focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                  placeholder:text-muted/50"
              />
              <button
                onClick={() => {
                  if (!manualNumber.trim()) return
                  handleSelectNumber(manualNumber.trim(), '')
                }}
                disabled={isPending || !manualNumber.trim()}
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium
                  hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {pendingAction === 'save-number' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Valider'}
              </button>
            </div>
          </div>

          {!loadingNumbers && availableNumbers.length === 0 && (
            <button
              onClick={fetchNumbers}
              className="text-xs text-primary hover:text-primary-dark transition-colors"
            >
              Recharger les numeros
            </button>
          )}
        </div>
      )}

      {/* ── Config panel ── */}
      {showConfig && (
        <div className="bg-surface-dark rounded-lg border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Configuration Ringover</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Numero accueil</span>
            <span className="font-medium">
              {connection.accueil_label || connection.accueil_number || <span className="italic text-muted">Non configure</span>}
            </span>
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
                setShowNumberPicker(true)
                setShowConfig(false)
                if (availableNumbers.length === 0) fetchNumbers()
              }}
              disabled={isPending}
              className="text-xs text-muted hover:text-primary transition-colors"
            >
              {connection.accueil_number ? 'Changer le numero' : 'Configurer le numero'}
            </button>
            {connection.accueil_number && (
              <>
                <span className="text-border">|</span>
                <button
                  onClick={() => {
                    setPendingAction('clear-number')
                    startTransition(async () => {
                      const r = await saveAccueilNumber({ accueil_number: '', accueil_label: '', purge_calls: false })
                      if (!r.error) {
                        toast.success('Numero d\'accueil supprime — tous les appels seront synchronises')
                        router.refresh()
                      }
                      setPendingAction(null)
                    })
                  }}
                  disabled={isPending}
                  className="text-xs text-muted hover:text-warning transition-colors"
                >
                  Voir tous les appels
                </button>
              </>
            )}
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
