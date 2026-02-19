'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { switchEstablishment } from '@/lib/actions/switch-establishment'
import { createEstablishment } from '@/lib/actions/establishments'
import { ChevronDownIcon } from '@/components/icons'
import type { Establishment } from '@/lib/types/database'

const SUPER_ADMIN_EMAIL = 'clement.scailteux@gmail.com'

interface EstablishmentSwitcherProps {
  establishments: Establishment[]
  currentEstablishment: Establishment
  collapsed?: boolean
  userEmail?: string
}

function EstablishmentLogo({ establishment, size = 32 }: { establishment: Establishment; size?: number }) {
  if (establishment.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={establishment.logo_url}
        alt="Logo"
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-white shrink-0"
      style={{ width: size, height: size }}
    >
      {establishment.name[0]?.toUpperCase() || '?'}
    </div>
  )
}

export function EstablishmentSwitcher({ establishments, currentEstablishment, collapsed, userEmail }: EstablishmentSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isCreating])

  function handleSwitch(estabId: string) {
    if (estabId === currentEstablishment.id) {
      setIsOpen(false)
      return
    }
    startTransition(async () => {
      await switchEstablishment(estabId)
      setIsOpen(false)
      router.refresh()
    })
  }

  function handleCreate() {
    const name = newName.trim()
    if (!name) return

    startTransition(async () => {
      const result = await createEstablishment({ name })
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.data) {
        await switchEstablishment(result.data.id)
        toast.success(`Etablissement "${name}" cree`)
        setNewName('')
        setIsCreating(false)
        setIsOpen(false)
        router.refresh()
      }
    })
  }

  if (collapsed) {
    return (
      <div className="flex items-center justify-center" title={currentEstablishment.name}>
        <EstablishmentLogo establishment={currentEstablishment} />
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 w-full overflow-hidden cursor-pointer"
        disabled={isPending}
      >
        <EstablishmentLogo establishment={currentEstablishment} />
        <div className="min-w-0 flex-1 text-left">
          <h1 className="font-bold text-sm text-primary-light truncate">{currentEstablishment.name}</h1>
          <p className="text-[10px] text-muted truncate">
            {currentEstablishment.description || 'Gestion & Facturation'}
          </p>
        </div>
        <ChevronDownIcon className={`w-4 h-4 text-muted shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setIsOpen(false); setIsCreating(false) }} />
          <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-xl z-50 py-1 animate-fade-up">
            {establishments.map((estab) => (
              <button
                key={estab.id}
                onClick={() => handleSwitch(estab.id)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2
                  ${estab.id === currentEstablishment.id
                    ? 'bg-primary/10 text-primary-light font-medium'
                    : 'text-muted hover:text-text hover:bg-surface-hover'
                  }`}
              >
                <EstablishmentLogo establishment={estab} size={20} />
                <span className="truncate">{estab.name}</span>
              </button>
            ))}

            {userEmail === SUPER_ADMIN_EMAIL && (
            <div className="border-t border-border mt-1 pt-1">
              {isCreating ? (
                <div className="px-3 py-2 space-y-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate()
                      if (e.key === 'Escape') { setIsCreating(false); setNewName('') }
                    }}
                    placeholder="Nom de l'etablissement"
                    className="w-full px-2.5 py-1.5 bg-surface-dark border border-border rounded text-sm
                      focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                      placeholder:text-muted/50"
                    disabled={isPending}
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleCreate}
                      disabled={isPending || !newName.trim()}
                      className="flex-1 px-2.5 py-1.5 rounded text-xs font-medium bg-primary text-white
                        hover:bg-primary-dark transition-colors disabled:opacity-50"
                    >
                      {isPending ? 'Creation...' : 'Creer'}
                    </button>
                    <button
                      onClick={() => { setIsCreating(false); setNewName('') }}
                      className="px-2.5 py-1.5 rounded text-xs font-medium text-muted
                        hover:bg-surface-hover transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-surface-hover transition-colors flex items-center gap-2"
                >
                  <div className="w-5 h-5 rounded-full border-2 border-dashed border-primary/40 flex items-center justify-center shrink-0">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <span>Nouvel etablissement</span>
                </button>
              )}
            </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
