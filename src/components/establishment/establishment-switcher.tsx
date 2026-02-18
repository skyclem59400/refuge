'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { switchEstablishment } from '@/lib/actions/switch-establishment'
import { ChevronDownIcon } from '@/components/icons'
import type { Establishment } from '@/lib/types/database'

interface EstablishmentSwitcherProps {
  establishments: Establishment[]
  currentEstablishment: Establishment
  collapsed?: boolean
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

export function EstablishmentSwitcher({ establishments, currentEstablishment, collapsed }: EstablishmentSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const hasMultiple = establishments.length > 1

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
        onClick={() => hasMultiple && setIsOpen(!isOpen)}
        className={`flex items-center gap-3 w-full overflow-hidden ${hasMultiple ? 'cursor-pointer' : 'cursor-default'}`}
        disabled={isPending}
      >
        <EstablishmentLogo establishment={currentEstablishment} />
        <div className="min-w-0 flex-1 text-left">
          <h1 className="font-bold text-sm text-primary-light truncate">{currentEstablishment.name}</h1>
          <p className="text-[10px] text-muted truncate">
            {currentEstablishment.description || 'Gestion & Facturation'}
          </p>
        </div>
        {hasMultiple && (
          <ChevronDownIcon className={`w-4 h-4 text-muted shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && hasMultiple && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
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
          </div>
        </>
      )}
    </div>
  )
}
