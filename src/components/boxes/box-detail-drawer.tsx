'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X, Settings, Plus, Printer, Package, Move, Footprints } from 'lucide-react'
import type { ZoneColor } from '@/lib/zone-colors'
import type { BoxAnimal, EnrichedBox, BoxSummary } from './types'
import { MoveAnimalMenu } from './move-animal-menu'
import { AssignOutingModal } from './assign-outing-modal'
import { SPECIES_LABELS_PLURAL } from '@/lib/species'
import type { AnimalSpecies } from '@/lib/types/database'

interface Props {
  box: EnrichedBox
  color: ZoneColor
  canManage: boolean
  allBoxes: BoxSummary[]
  onClose: () => void
  onAssign: () => void
  onEdit: () => void
}

function speciesEmoji(s: string): string {
  if (s === 'cat') return '🐱'
  if (s === 'dog') return '🐶'
  return '🐾'
}

function statusColor(status: string | null | undefined) {
  switch (status) {
    case 'shelter': return { bg: 'bg-emerald-500', label: 'Refuge' }
    case 'pound': return { bg: 'bg-amber-500', label: 'Fourrière' }
    case 'foster_family': return { bg: 'bg-violet-500', label: 'FA' }
    case 'boarding': return { bg: 'bg-teal-500', label: 'Pension' }
    default: return { bg: 'bg-zinc-400', label: status ?? '—' }
  }
}

function ageLabel(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null
  const bd = new Date(birthDate)
  if (Number.isNaN(bd.getTime())) return null
  const now = new Date()
  let years = now.getFullYear() - bd.getFullYear()
  const m = now.getMonth() - bd.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) years--
  if (years < 1) {
    const months = Math.max(
      0,
      (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth())
    )
    return `${months} mois`
  }
  return `${years} an${years > 1 ? 's' : ''}`
}

export function BoxDetailDrawer({
  box,
  color,
  canManage,
  allBoxes,
  onClose,
  onAssign,
  onEdit,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const [moveMenuFor, setMoveMenuFor] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!mounted) return null

  const isFull = box.animal_count >= box.capacity
  const remaining = box.capacity - box.animal_count

  return createPortal(
    <>
      <div className="fixed inset-0 z-[99] bg-black/50" onClick={onClose} aria-hidden />

      <aside
        className="fixed top-0 right-0 z-[100] h-screen w-full sm:w-[460px] bg-surface border-l border-border shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={`Détail ${box.name}`}
      >
        {/* Header coloré zone */}
        <header className={`relative ${color.bg} ${color.textOn} px-5 py-4 shrink-0 overflow-hidden`}>
          <div
            className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none"
            aria-hidden
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm shrink-0 text-2xl">
                {speciesEmoji(box.species_type)}
              </span>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-75">
                  Box
                </div>
                <h2 className="text-xl font-bold leading-tight truncate">{box.name}</h2>
                {box.zone && (
                  <div className="text-xs opacity-80 truncate mt-0.5">
                    {box.zone.parent ? `${box.zone.parent.name} › ${box.zone.name}` : box.zone.name}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="text-white/80 hover:text-white shrink-0 p-1.5 rounded-lg hover:bg-white/10"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Stats inline */}
          <div className="relative flex items-center gap-2 mt-4">
            <span className="px-2.5 py-1 rounded-full bg-white/15 text-xs font-semibold backdrop-blur-sm">
              {box.animal_count}/{box.capacity}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white/15 text-xs font-semibold backdrop-blur-sm">
              {box.species_type === 'mixed' ? 'Mixte' : box.species_type === 'farm' ? 'Ferme' : box.species_type === 'other' ? 'Autres' : SPECIES_LABELS_PLURAL[box.species_type as AnimalSpecies] || box.species_type}
            </span>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                box.status === 'available'
                  ? 'bg-success/85 text-white'
                  : box.status === 'occupied'
                    ? 'bg-warning/85 text-white'
                    : 'bg-error/85 text-white'
              }`}
            >
              {box.status === 'available' ? 'Disponible' : box.status === 'occupied' ? 'Occupé' : 'Maintenance'}
            </span>
          </div>
        </header>

        {/* Action bar */}
        {canManage && (
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border/50 shrink-0">
            {!isFull && (
              <button
                onClick={onAssign}
                type="button"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold gradient-primary text-white shadow-md shadow-primary/30 hover:opacity-90"
              >
                <Plus size={14} />
                Assigner {remaining > 0 && `(${remaining})`}
              </button>
            )}
            <button
              onClick={onEdit}
              type="button"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-border hover:bg-surface-hover"
            >
              <Settings size={14} />
              Modifier
            </button>
            <a
              href={`/api/pdf/box/${box.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-border hover:bg-surface-hover text-muted hover:text-text"
              title="Fiche PDF"
            >
              <Printer size={14} />
            </a>
          </div>
        )}

        {/* Animaux */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {box.animals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div
                className={`flex items-center justify-center w-16 h-16 rounded-2xl ${color.bgSoft} border ${color.borderSoft} mb-3`}
              >
                <Package className={`w-7 h-7 ${color.text}`} />
              </div>
              <p className={`text-sm font-bold ${color.text}`}>Box disponible</p>
              <p className="text-xs text-muted mt-1">
                {box.capacity} place{box.capacity > 1 ? 's' : ''} libre{box.capacity > 1 ? 's' : ''}
              </p>
              {canManage && (
                <button
                  onClick={onAssign}
                  type="button"
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold gradient-primary text-white"
                >
                  <Plus size={12} />
                  Ajouter un animal
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {box.animals.map((animal) => (
                <AnimalRow
                  key={animal.id}
                  animal={animal}
                  boxId={box.id}
                  canManage={canManage}
                  allBoxes={allBoxes}
                  moveMenuOpen={moveMenuFor === animal.id}
                  onOpenMove={() => setMoveMenuFor(animal.id)}
                  onCloseMove={() => setMoveMenuFor(null)}
                />
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>,
    document.body
  )
}

function AnimalRow({
  animal,
  boxId,
  canManage,
  allBoxes,
  moveMenuOpen,
  onOpenMove,
  onCloseMove,
}: {
  animal: BoxAnimal
  boxId: string
  canManage: boolean
  allBoxes: BoxSummary[]
  moveMenuOpen: boolean
  onOpenMove: () => void
  onCloseMove: () => void
}) {
  const status = statusColor(animal.status)
  const age = ageLabel(animal.birth_date)
  const [showOutingModal, setShowOutingModal] = useState(false)
  // Bouton sortie : utile pour les chiens présents au refuge / fourrière / FA
  const canAssignOuting = animal.species === 'dog' && (
    animal.status === 'shelter' || animal.status === 'pound' || animal.status === 'boarding'
  )

  return (
    <li className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface border border-border hover:border-primary/30 transition-colors group">
      {/* Avatar */}
      <Link href={`/animals/${animal.id}`} className="relative w-12 h-12 rounded-full overflow-hidden bg-muted/15 shrink-0">
        {animal.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={animal.photo_url}
            alt={animal.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-2xl">
            {speciesEmoji(animal.species)}
          </div>
        )}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${status.bg} ring-2 ring-surface`}
        />
      </Link>

      {/* Info */}
      <Link href={`/animals/${animal.id}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-sm truncate group-hover:text-primary">{animal.name}</span>
          {animal.sex === 'male' && (
            <span className="text-blue-500 text-sm font-bold">♂</span>
          )}
          {animal.sex === 'female' && (
            <span className="text-pink-500 text-sm font-bold">♀</span>
          )}
        </div>
        <div className="text-[11px] text-muted flex items-center gap-1 flex-wrap">
          <span>{status.label}</span>
          {age && <><span className="opacity-50">·</span><span>{age}</span></>}
          {animal.sterilized && <><span className="opacity-50">·</span><span title="Stérilisé">⚕</span></>}
          {animal.adoptable && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500 text-white">
              Adoptable
            </span>
          )}
          {animal.reserved && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-white">
              Réservé
            </span>
          )}
        </div>
      </Link>

      {canAssignOuting && (
        <button
          onClick={() => setShowOutingModal(true)}
          type="button"
          title="Assigner une sortie / défouloir à un bénévole"
          className="shrink-0 p-1.5 rounded-md text-muted hover:bg-primary/10 hover:text-primary opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        >
          <Footprints size={13} />
        </button>
      )}

      {canManage && (
        <button
          onClick={onOpenMove}
          type="button"
          title="Déplacer vers un autre box"
          className="shrink-0 p-1.5 rounded-md text-muted hover:bg-primary/10 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Move size={13} />
        </button>
      )}

      {moveMenuOpen && (
        <MoveAnimalMenu
          animalId={animal.id}
          animalName={animal.name}
          animalSpecies={animal.species}
          currentBoxId={boxId}
          allBoxes={allBoxes}
          onClose={onCloseMove}
        />
      )}

      {showOutingModal && (
        <AssignOutingModal
          animalId={animal.id}
          animalName={animal.name}
          animalPhotoUrl={animal.photo_url ?? null}
          animalSpeciesEmoji={speciesEmoji(animal.species)}
          onClose={() => setShowOutingModal(false)}
        />
      )}
    </li>
  )
}
