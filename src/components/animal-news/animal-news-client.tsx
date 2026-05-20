'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  Plus,
  PawPrint,
  Heart,
  Trash2,
  ImageIcon,
  ExternalLink,
  Search,
  X,
  Calendar,
  Sparkles,
  Layers,
} from 'lucide-react'
import { formatDateShort } from '@/lib/utils'
import { getStatusLabel } from '@/lib/sda-utils'
import { SPECIES_LABELS } from '@/lib/species'
import { deleteAnimalNews } from '@/lib/actions/animal-news'
import type {
  AnimalNewsWithAnimal,
  AnimalNewsMosaic,
  NewsCategory,
} from '@/lib/types/database'
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
  shelteredNews: AnimalNewsWithAnimal[]
  alumniNews: AnimalNewsWithAnimal[]
  shelteredAnimals: EligibleAnimal[]
  alumniAnimals: EligibleAnimal[]
  mosaics: AnimalNewsMosaic[]
  establishmentId: string
}

const TABS: { id: NewsCategory; label: string; description: string }[] = [
  {
    id: 'sheltered',
    label: 'Suivi des protégés',
    description: 'Nouvelles des animaux encore au refuge — visibles par les parrains',
  },
  {
    id: 'alumni',
    label: 'Nouvelles des sortis',
    description: 'Récits des adoptés et FA — partage Facebook',
  },
]

export function AnimalNewsClient({
  shelteredNews,
  alumniNews,
  shelteredAnimals,
  alumniAnimals,
  mosaics,
  establishmentId,
}: Readonly<AnimalNewsClientProps>) {
  const [activeTab, setActiveTab] = useState<NewsCategory>('sheltered')
  const [search, setSearch] = useState('')
  const [animalFilter, setAnimalFilter] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const newsList = activeTab === 'sheltered' ? shelteredNews : alumniNews
  const animalsList = activeTab === 'sheltered' ? shelteredAnimals : alumniAnimals

  const filtered = useMemo(() => {
    let list = [...newsList]
    if (animalFilter) list = list.filter((n) => n.animal_id === animalFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (n) =>
          n.animal.name.toLowerCase().includes(q) ||
          (n.text || '').toLowerCase().includes(q) ||
          (n.received_from || '').toLowerCase().includes(q),
      )
    }
    if (dateFrom) list = list.filter((n) => n.received_at >= dateFrom)
    if (dateTo) list = list.filter((n) => n.received_at <= dateTo)
    return list
  }, [newsList, animalFilter, search, dateFrom, dateTo])

  function handleDelete(id: string) {
    if (!window.confirm('Supprimer cette nouvelle ? Les photos seront aussi supprimées.')) return
    startTransition(async () => {
      const result = await deleteAnimalNews(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Nouvelle supprimée')
        router.refresh()
      }
    })
  }

  function clearFilters() {
    setSearch('')
    setAnimalFilter(null)
    setDateFrom('')
    setDateTo('')
  }

  const hasFilters = search || animalFilter || dateFrom || dateTo

  return (
    <div className="space-y-6">
      {/* Onglets */}
      <div className="border-b border-border">
        <nav className="flex gap-1 -mb-px" aria-label="Tabs">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            const count = tab.id === 'sheltered' ? shelteredNews.length : alumniNews.length
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id)
                  clearFilters()
                }}
                className={
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ' +
                  (isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-text hover:border-border-strong')
                }
              >
                {tab.id === 'sheltered' ? (
                  <PawPrint className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Heart className="w-4 h-4" aria-hidden="true" />
                )}
                {tab.label}
                <span
                  className={
                    'inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-semibold rounded-full ' +
                    (isActive ? 'bg-primary text-white' : 'bg-surface-hover text-muted')
                  }
                >
                  {count}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Sous-titre de l'onglet courant */}
      <p className="text-sm text-muted -mt-2">
        {TABS.find((t) => t.id === activeTab)!.description}
      </p>

      {/* Toolbar : ajout + filtres */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          {/* Recherche texte */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un nom, un texte..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Filtre par animal */}
          <select
            value={animalFilter ?? ''}
            onChange={(e) => setAnimalFilter(e.target.value || null)}
            className="px-3 py-2 text-sm bg-surface border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Tous les animaux</option>
            {animalsList.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {SPECIES_LABELS[a.species as keyof typeof SPECIES_LABELS] || a.species}
              </option>
            ))}
          </select>

          {/* Range dates */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-2 text-xs bg-surface border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label="Du"
            />
            <span className="text-xs text-muted">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-2 text-xs bg-surface border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label="Au"
            />
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted hover:text-text"
            >
              <X className="w-3 h-3" aria-hidden="true" />
              Réinitialiser
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-md hover:bg-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Ajouter une nouvelle
        </button>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="rounded-lg bg-surface border border-border p-10 text-center">
          <Sparkles className="w-8 h-8 mx-auto text-muted/40 mb-3" aria-hidden="true" />
          <p className="text-sm text-muted">
            {hasFilters
              ? 'Aucune nouvelle ne correspond aux filtres.'
              : activeTab === 'sheltered'
              ? "Aucune nouvelle de protégé pour l'instant. Ajoutez-en une !"
              : "Aucune nouvelle d'animal sorti. Ajoutez-en une !"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((news) => (
            <NewsCard
              key={news.id}
              news={news}
              onDelete={() => handleDelete(news.id)}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {/* Mosaïques (Alumni uniquement) */}
      {activeTab === 'alumni' && mosaics.length > 0 && (
        <section className="pt-6 border-t border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" aria-hidden="true" />
            Récaps multi-animaux ({mosaics.length})
          </h2>
          <p className="text-xs text-muted mt-1">
            Compositions publiées sur Facebook combinant plusieurs nouvelles.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {mosaics.map((mosaic) => (
              <MosaicCard key={mosaic.id} mosaic={mosaic} />
            ))}
          </div>
        </section>
      )}

      {/* Modal d'ajout */}
      {showAddModal && (
        <AddNewsModal
          category={activeTab}
          eligibleAnimals={animalsList}
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

// ============================================
// Sub-components
// ============================================

function NewsCard({
  news,
  onDelete,
  isPending,
}: {
  news: AnimalNewsWithAnimal
  onDelete: () => void
  isPending: boolean
}) {
  const firstPhoto = news.photos?.[0]
  return (
    <article className="bg-surface border border-border rounded-lg overflow-hidden hover:border-border-strong transition-colors">
      {/* Photo principale */}
      <div className="relative aspect-[4/3] bg-surface-hover">
        {firstPhoto ? (
          <Image
            src={firstPhoto.url}
            alt={news.animal.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted/40">
            <ImageIcon className="w-12 h-12" aria-hidden="true" />
          </div>
        )}
        {news.photos.length > 1 && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-white bg-black/60 backdrop-blur rounded-full">
            <ImageIcon className="w-3 h-3" aria-hidden="true" />+{news.photos.length - 1}
          </span>
        )}
        <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-white bg-primary/95 rounded-full">
          {SPECIES_LABELS[news.animal.species as keyof typeof SPECIES_LABELS] || news.animal.species}
        </div>
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-text">{news.animal.name}</h3>
            <p className="text-[11px] text-muted">
              {getStatusLabel(news.animal.status)} ·{' '}
              <time dateTime={news.received_at}>{formatDateShort(news.received_at)}</time>
            </p>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={`/api/visuels/animal-news/${news.id}?format=png`}
              target="_blank"
              rel="noopener noreferrer"
              title="Exporter en visuel Facebook 1080×1350"
              className="inline-flex items-center justify-center w-7 h-7 text-muted hover:text-primary hover:bg-surface-hover rounded transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              title="Supprimer"
              className="inline-flex items-center justify-center w-7 h-7 text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {news.text && (
          <p className="mt-2 text-xs text-text/85 leading-relaxed line-clamp-3">{news.text}</p>
        )}

        {news.received_from && (
          <p className="mt-2 text-[10px] text-muted uppercase tracking-wider">
            ✉ {news.received_from}
          </p>
        )}
      </div>
    </article>
  )
}

function MosaicCard({ mosaic }: { mosaic: AnimalNewsMosaic }) {
  const title = mosaic.title || `Récap du ${formatDateShort(mosaic.posted_at || mosaic.created_at)}`
  return (
    <article className="bg-surface border border-border rounded-lg overflow-hidden">
      {mosaic.generated_image_url ? (
        <div className="relative aspect-[4/5] bg-surface-hover">
          <Image
            src={mosaic.generated_image_url}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover"
          />
        </div>
      ) : (
        <div className="aspect-[4/5] bg-surface-hover flex items-center justify-center text-muted/40">
          <Layers className="w-10 h-10" aria-hidden="true" />
        </div>
      )}
      <div className="p-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-[11px] text-muted mt-0.5">
          {mosaic.news_ids.length} nouvelles · publié le{' '}
          {formatDateShort(mosaic.posted_at || mosaic.created_at)}
        </p>
      </div>
    </article>
  )
}
