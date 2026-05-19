'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { Plus, Inbox, History, Sparkles, Trash2, ImageIcon, ExternalLink, Heart } from 'lucide-react'
import { formatDateShort } from '@/lib/utils'
import { getStatusLabel } from '@/lib/sda-utils'
import { SPECIES_LABELS } from '@/lib/species'
import { deleteAnimalNews, markNewsAsPosted } from '@/lib/actions/animal-news'
import type { AnimalNewsWithAnimal, AnimalNewsMosaic } from '@/lib/types/database'
import { AddNewsModal } from './add-news-modal'

interface EligibleAnimal {
  id: string
  name: string
  species: string
  sex: string
  status: string
  exit_date: string | null
  photo_url: string | null
  birth_date: string | null
}

interface AnimalNewsClientProps {
  inbox: AnimalNewsWithAnimal[]
  history: { solos: AnimalNewsWithAnimal[]; mosaics: AnimalNewsMosaic[] }
  eligibleAnimals: EligibleAnimal[]
  establishmentId: string
}

type Tab = 'inbox' | 'history'

export function AnimalNewsClient({
  inbox,
  history,
  eligibleAnimals,
  establishmentId,
}: Readonly<AnimalNewsClientProps>) {
  const [activeTab, setActiveTab] = useState<Tab>('inbox')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleDelete(id: string) {
    if (!window.confirm('Supprimer cette nouvelle ? Les photos seront aussi supprimées.')) return
    startTransition(async () => {
      const result = await deleteAnimalNews(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Nouvelle supprimée')
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        router.refresh()
      }
    })
  }

  function handlePublishSolo() {
    const ids = [...selectedIds]
    if (ids.length !== 1) return
    const newsId = ids[0]
    // Ouvre directement le visuel solo dans un nouvel onglet
    window.open(`/api/visuels/animal-news/${newsId}?format=png`, '_blank')
    startTransition(async () => {
      const result = await markNewsAsPosted({ newsIds: [newsId] })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Marquée comme publiée')
        setSelectedIds(new Set())
        router.refresh()
      }
    })
  }

  function handlePublishMosaic() {
    const ids = [...selectedIds]
    if (ids.length < 2 || ids.length > 6) {
      toast.error('Sélectionne entre 2 et 6 nouvelles pour une mosaïque')
      return
    }
    // Visuel mosaïque
    window.open(`/api/visuels/animal-news/mosaic?ids=${ids.join(',')}&format=png`, '_blank')
    startTransition(async () => {
      const result = await markNewsAsPosted({ newsIds: ids })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Mosaïque publiée')
        setSelectedIds(new Set())
        router.refresh()
      }
    })
  }

  const selectedCount = selectedIds.size

  return (
    <div className="space-y-5">
      {/* Tabs + Add button */}
      <div className="flex items-center justify-between border-b border-border">
        <nav className="flex gap-0 -mb-px">
          <button
            type="button"
            onClick={() => setActiveTab('inbox')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'inbox'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            <Inbox className="w-4 h-4" />
            Inbox <span className="text-xs text-muted/70">({inbox.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            <History className="w-4 h-4" />
            Publiées <span className="text-xs text-muted/70">({history.solos.length + history.mosaics.length})</span>
          </button>
        </nav>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"
        >
          <Plus className="w-4 h-4" />
          Ajouter une nouvelle
        </button>
      </div>

      {/* Inbox tab */}
      {activeTab === 'inbox' && (
        <div className="space-y-4">
          {selectedCount > 0 && (
            <div className="flex items-center justify-between gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg sticky top-2 z-10 backdrop-blur">
              <div className="text-sm">
                <span className="font-semibold text-primary">{selectedCount}</span>{' '}
                <span className="text-muted">sélectionnée{selectedCount > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                {selectedCount === 1 && (
                  <button
                    type="button"
                    onClick={handlePublishSolo}
                    disabled={isPending}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    Publier en solo
                  </button>
                )}
                {selectedCount >= 2 && selectedCount <= 6 && (
                  <button
                    type="button"
                    onClick={handlePublishMosaic}
                    disabled={isPending}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    Publier en mosaïque ({selectedCount})
                  </button>
                )}
                {selectedCount > 6 && (
                  <span className="text-xs text-warning">Maximum 6 pour une mosaïque</span>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-1.5 text-sm text-muted hover:text-text transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {inbox.length === 0 ? (
            <div className="text-center py-12 bg-surface-dark/40 rounded-xl border border-dashed border-border">
              <Inbox className="w-10 h-10 text-muted/40 mx-auto mb-3" />
              <p className="text-sm text-muted">Aucune nouvelle en attente</p>
              <p className="text-xs text-muted/70 mt-1">
                Ajoute les photos et messages reçus pour les regrouper et les publier
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {inbox.map((news) => (
                <NewsCard
                  key={news.id}
                  news={news}
                  selected={selectedIds.has(news.id)}
                  onToggle={() => toggleSelect(news.id)}
                  onDelete={() => handleDelete(news.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {history.mosaics.length === 0 && history.solos.length === 0 && (
            <div className="text-center py-12 bg-surface-dark/40 rounded-xl border border-dashed border-border">
              <History className="w-10 h-10 text-muted/40 mx-auto mb-3" />
              <p className="text-sm text-muted">Aucune publication pour l&apos;instant</p>
            </div>
          )}

          {history.mosaics.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
                Mosaïques publiées
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.mosaics.map((mosaic) => (
                  <MosaicHistoryCard key={mosaic.id} mosaic={mosaic} />
                ))}
              </div>
            </section>
          )}

          {history.solos.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
                Publications solo
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.solos.map((news) => (
                  <NewsCard
                    key={news.id}
                    news={news}
                    selected={false}
                    onToggle={() => {}}
                    onDelete={() => handleDelete(news.id)}
                    isPublished
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {showAddModal && (
        <AddNewsModal
          eligibleAnimals={eligibleAnimals}
          establishmentId={establishmentId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

interface NewsCardProps {
  news: AnimalNewsWithAnimal
  selected: boolean
  onToggle: () => void
  onDelete: () => void
  isPublished?: boolean
}

function NewsCard({ news, selected, onToggle, onDelete, isPublished }: Readonly<NewsCardProps>) {
  const firstPhoto = news.photos?.[0]?.url
  const animal = news.animal

  return (
    <div
      className={`relative bg-surface rounded-xl border overflow-hidden transition-all ${
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40'
      }`}
    >
      {/* Photo */}
      <button
        type="button"
        onClick={isPublished ? undefined : onToggle}
        className="block w-full relative aspect-[4/3] bg-surface-dark cursor-pointer"
      >
        {firstPhoto ? (
          <Image src={firstPhoto} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" unoptimized />
        ) : (
          <div className="flex items-center justify-center h-full">
            <ImageIcon className="w-10 h-10 text-muted/30" />
          </div>
        )}
        {news.photos.length > 1 && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs font-medium">
            +{news.photos.length - 1}
          </div>
        )}
        {!isPublished && (
          <div
            className={`absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
              selected
                ? 'bg-primary border-primary'
                : 'bg-white/70 border-white/90 group-hover:bg-white'
            }`}
          >
            {selected && (
              <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        )}
      </button>

      {/* Content */}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">
              {animal?.name || 'Animal inconnu'}
            </div>
            <div className="text-xs text-muted truncate">
              {SPECIES_LABELS[animal?.species as keyof typeof SPECIES_LABELS] || animal?.species}
              {animal?.status && ` · ${getStatusLabel(animal.status)}`}
            </div>
          </div>
          <span className="text-[10px] text-muted/70 whitespace-nowrap">
            {formatDateShort(news.received_at)}
          </span>
        </div>

        {news.text && (
          <p className="text-xs text-text/80 line-clamp-3 italic">
            « {news.text} »
          </p>
        )}

        {news.received_from && (
          <p className="text-[11px] text-muted">— {news.received_from}</p>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          {isPublished && news.posted_at ? (
            <span className="text-[11px] text-success font-medium">
              Publié le {formatDateShort(news.posted_at)}
            </span>
          ) : (
            <span className="text-[11px] text-muted">En attente</span>
          )}
          <div className="flex items-center gap-1">
            <a
              href={`/api/visuels/animal-news/${news.id}?format=png`}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded text-muted hover:text-primary hover:bg-primary/10 transition-colors"
              title="Voir le visuel"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 rounded text-muted hover:text-danger hover:bg-danger/10 transition-colors"
              title="Supprimer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MosaicHistoryCard({ mosaic }: Readonly<{ mosaic: AnimalNewsMosaic }>) {
  const idsParam = mosaic.news_ids.join(',')
  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <a
        href={`/api/visuels/animal-news/mosaic?ids=${idsParam}&format=png${mosaic.title ? `&title=${encodeURIComponent(mosaic.title)}` : ''}`}
        target="_blank"
        rel="noreferrer"
        className="block aspect-[4/5] bg-surface-dark relative hover:opacity-90 transition-opacity"
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <Heart className="w-12 h-12 text-primary/30" />
        </div>
        <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Mosaïque
        </div>
      </a>
      <div className="p-3">
        <div className="text-sm font-semibold truncate">{mosaic.title || 'Quelques nouvelles'}</div>
        <div className="text-xs text-muted mt-0.5">
          {mosaic.news_ids.length} animaux ·{' '}
          {mosaic.posted_at ? `Publié le ${formatDateShort(mosaic.posted_at)}` : 'Brouillon'}
        </div>
        <a
          href={`/api/visuels/animal-news/mosaic?ids=${idsParam}&format=png${mosaic.title ? `&title=${encodeURIComponent(mosaic.title)}` : ''}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Ouvrir le visuel <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}
