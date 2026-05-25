'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

/**
 * Bouton "Retour" qui essaie router.back() (instantané via cache navigateur)
 * et tombe en fallback sur une navigation explicite vers `href` si
 * window.history n'a pas d'entrée précédente (ex: arrivée via URL directe).
 */
export function BackToBoxes({ href = '/boxes', label = 'Retour aux box' }: { readonly href?: string; readonly label?: string }) {
  const router = useRouter()

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault()
    // window.history.length > 1 ne garantit pas qu'on vient du même origin,
    // mais c'est le meilleur signal disponible côté client.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(href)
    }
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className="inline-flex items-center gap-2 text-sm text-muted hover:text-text transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </a>
  )
}
