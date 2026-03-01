'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Wifi, WifiOff, Phone } from 'lucide-react'
import {
  saveRingoverConnection,
  disconnectRingover,
  getRingoverNumbers,
} from '@/lib/actions/ringover'
import type { RingoverConnection, RingoverNumber } from '@/lib/types/database'

interface RingoverSettingsProps {
  connection: RingoverConnection | null
}

export function RingoverSettings({ connection }: RingoverSettingsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  // Form state
  const [apiKey, setApiKey] = useState('')
  const [numbers, setNumbers] = useState<RingoverNumber[]>([])
  const [selectedNumber, setSelectedNumber] = useState('')
  const [showNumberPicker, setShowNumberPicker] = useState(false)

  function handleConnect() {
    if (!apiKey.trim()) {
      toast.error('Veuillez entrer votre cle API Ringover')
      return
    }

    setPendingAction('connect')
    startTransition(async () => {
      // First, save connection with just the API key
      const result = await saveRingoverConnection({ api_key: apiKey.trim() })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Connexion Ringover etablie')
        setApiKey('')
        router.refresh()
        // Auto-open number picker
        loadNumbers()
      }
      setPendingAction(null)
    })
  }

  function loadNumbers() {
    setPendingAction('numbers')
    startTransition(async () => {
      const result = await getRingoverNumbers()
      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setNumbers(result.data)
        setShowNumberPicker(true)
        if (result.data.length === 0) {
          toast.error('Aucun numero trouve sur ce compte Ringover')
        }
      }
      setPendingAction(null)
    })
  }

  function handleSelectNumber() {
    if (!selectedNumber) {
      toast.error('Selectionnez un numero')
      return
    }

    const chosen = numbers.find((n) => n.number === selectedNumber)

    setPendingAction('save-number')
    startTransition(async () => {
      const result = await saveRingoverConnection({
        api_key: connection!.api_key,
        astreinte_number: selectedNumber,
        astreinte_label: chosen?.label || selectedNumber,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Ligne d\'astreinte configuree')
        setShowNumberPicker(false)
        router.refresh()
      }
      setPendingAction(null)
    })
  }

  function handleDisconnect() {
    setPendingAction('disconnect')
    startTransition(async () => {
      const result = await disconnectRingover()
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Ringover deconnecte')
        router.refresh()
      }
      setPendingAction(null)
    })
  }

  // Connected state
  if (connection) {
    return (
      <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/15">
              <Wifi className="w-5 h-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold">Ringover</h3>
              <p className="text-xs text-success font-medium">Connecte</p>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={isPending}
            className="text-xs text-error hover:text-error/80 font-medium transition-colors disabled:opacity-50"
          >
            {pendingAction === 'disconnect' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Deconnecter'}
          </button>
        </div>

        {/* Astreinte line info */}
        {connection.astreinte_number ? (
          <div className="flex items-center gap-3 p-3 bg-surface-hover/50 rounded-lg">
            <Phone className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-medium">
                {connection.astreinte_label || connection.astreinte_number}
              </p>
              <p className="text-xs text-muted">{connection.astreinte_number}</p>
            </div>
            <button
              onClick={loadNumbers}
              disabled={isPending}
              className="ml-auto text-xs text-primary hover:text-primary-dark font-medium transition-colors disabled:opacity-50"
            >
              {pendingAction === 'numbers' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Changer'}
            </button>
          </div>
        ) : (
          <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <p className="text-sm text-warning font-medium">Aucune ligne d&apos;astreinte selectionnee</p>
            <button
              onClick={loadNumbers}
              disabled={isPending}
              className="mt-2 text-xs text-primary hover:text-primary-dark font-medium transition-colors disabled:opacity-50"
            >
              {pendingAction === 'numbers' ? (
                <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Chargement...</span>
              ) : (
                'Selectionner une ligne'
              )}
            </button>
          </div>
        )}

        {/* Number picker */}
        {showNumberPicker && numbers.length > 0 && (
          <div className="space-y-3 border border-border rounded-lg p-3">
            <p className="text-sm font-medium">Selectionnez la ligne d&apos;astreinte :</p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {numbers.map((num) => (
                <label
                  key={num.number}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedNumber === num.number ? 'bg-primary/10 border border-primary/20' : 'hover:bg-surface-hover'
                  }`}
                >
                  <input
                    type="radio"
                    name="astreinte_number"
                    value={num.number}
                    checked={selectedNumber === num.number}
                    onChange={(e) => setSelectedNumber(e.target.value)}
                    className="accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium">{num.label || num.number}</p>
                    <p className="text-xs text-muted">{num.number} · {num.type}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSelectNumber}
                disabled={isPending || !selectedNumber}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {pendingAction === 'save-number' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
              </button>
              <button
                onClick={() => setShowNumberPicker(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-surface-hover transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Not connected state
  return (
    <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted/15">
          <WifiOff className="w-5 h-5 text-muted" />
        </div>
        <div>
          <h3 className="font-semibold">Ringover</h3>
          <p className="text-xs text-muted">Non connecte</p>
        </div>
      </div>

      <p className="text-sm text-muted">
        Connectez Ringover pour pre-remplir les informations de l&apos;appelant
        dans le formulaire d&apos;intervention a partir des appels entrants sur la ligne d&apos;astreinte.
      </p>

      <div>
        <label className="block text-sm font-medium mb-1">Cle API Ringover</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Votre cle API Ringover"
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <p className="text-xs text-muted mt-1">
          Disponible dans Dashboard Ringover &gt; Parametres &gt; API Keys
        </p>
      </div>

      <button
        onClick={handleConnect}
        disabled={isPending || !apiKey.trim()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
      >
        {pendingAction === 'connect' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
        Connecter
      </button>
    </div>
  )
}
