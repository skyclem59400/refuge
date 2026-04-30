'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Image from 'next/image'
import { AnimalPhotos } from '@/components/animals/animal-photos'
import { AnimalForm } from '@/components/animals/animal-form'
import { AnimalIdentificationCard } from '@/components/animals/animal-identification-card'
import { AnimalAttachmentsSection } from '@/components/animals/animal-attachments-section'
import { HealthRecordForm } from '@/components/health/health-record-form'
import { MovementForm } from '@/components/animals/movement-form'
import { FosterContractsTab } from '@/components/foster-contracts/foster-contracts-tab'
import { ApplyProtocolModal } from '@/components/health/apply-protocol-modal'
import { updatePost, deletePost } from '@/lib/actions/social-posts'
import { formatDateShort, formatCurrency } from '@/lib/utils'
import {
  getSexLabel,
  getMovementLabel,
  getHealthTypeLabel,
} from '@/lib/sda-utils'
import { PostGenerator } from '@/components/social/post-generator'
import { IcadDeclarations } from '@/components/icad/icad-declarations'
import type { Animal, AnimalPhoto, AnimalMovement, AnimalHealthRecord, AnimalTreatment, AnimalStatus, Box, SocialPost, IcadDeclaration, ActivityLog, FosterContract, HealthProtocolWithSteps } from '@/lib/types/database'

interface FosterContractWithRelations extends FosterContract {
  foster?: {
    id: string
    name: string
    email: string | null
    phone: string | null
    city: string | null
  }
}
import { stopTreatment } from '@/lib/actions/treatments'
import { ActivityTimeline } from '@/components/ui/activity-timeline'
import { formatOutingDuration } from '@/lib/sda-utils'
import {
  Fingerprint,
  MapPin,
  FileText,
  ArrowRightLeft,
  HeartPulse,
  Pencil,
  Stethoscope,
  Calendar,
  AlertTriangle,
  Camera,
  Plus,
  Info,
  ImageIcon,
  Share2,
  Shield,
  Trash2,
  Copy,
  Phone,
  Save,
  X,
  Loader2,
  ClipboardList,
  Footprints,
  HardHat,
  Pill,
  StopCircle,
  Clock,
  Home,
  ListChecks,
} from 'lucide-react'

type TabId = 'info' | 'photos' | 'health' | 'movements' | 'foster' | 'documents' | 'outings' | 'posts' | 'icad' | 'activity'

interface AnimalOuting {
  id: string
  animal_id: string
  walked_by: string
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  notes: string | null
  rating: number | null
  rating_comment: string | null
  is_tig?: boolean
  tig_walker_name?: string | null
  created_at: string
}

interface AnimalDetailTabsProps {
  animal: Animal
  photos: AnimalPhoto[]
  movements: AnimalMovement[]
  healthRecords: AnimalHealthRecord[]
  treatments?: AnimalTreatment[]
  outings?: AnimalOuting[]
  socialPosts: SocialPost[]
  icadDeclarations: IcadDeclaration[]
  fosterContracts?: FosterContractWithRelations[]
  healthProtocols?: HealthProtocolWithSteps[]
  boxes: Box[]
  userNames: Record<string, string>
  establishmentName: string
  establishmentPhone: string
  canManageAnimals: boolean
  canManageHealth: boolean
  canManageMovements: boolean
  canManagePosts: boolean
  isAdmin?: boolean
  activityLogs?: ActivityLog[]
}

const baseTabs: { id: TabId; label: string; icon: React.ElementType; countKey?: 'photos' | 'healthRecords' | 'movements' | 'outings' | 'socialPosts' | 'icadDeclarations' | 'activityLogs' | 'fosterContracts'; adminOnly?: boolean }[] = [
  { id: 'info', label: 'Infos', icon: Info },
  { id: 'photos', label: 'Photos', icon: Camera, countKey: 'photos' },
  { id: 'health', label: 'Sante', icon: HeartPulse, countKey: 'healthRecords' },
  { id: 'movements', label: 'Mouvements', icon: ArrowRightLeft, countKey: 'movements' },
  { id: 'foster', label: 'Famille d’accueil', icon: Home, countKey: 'fosterContracts' },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'outings', label: 'Sorties', icon: Footprints, countKey: 'outings' },
  { id: 'posts', label: 'Publications', icon: Share2, countKey: 'socialPosts' },
  { id: 'icad', label: 'I-CAD', icon: Shield, countKey: 'icadDeclarations' },
  { id: 'activity', label: 'Activite', icon: ClipboardList, countKey: 'activityLogs', adminOnly: true },
]

export function AnimalDetailTabs({
  animal,
  photos,
  movements,
  healthRecords,
  socialPosts,
  icadDeclarations,
  fosterContracts = [],
  healthProtocols = [],
  boxes,
  userNames,
  establishmentName,
  establishmentPhone,
  canManageAnimals,
  canManageHealth,
  canManageMovements,
  treatments = [],
  outings = [],
  canManagePosts,
  isAdmin = false,
  activityLogs = [],
}: Readonly<AnimalDetailTabsProps>) {
  const [activeTab, setActiveTab] = useState<TabId>('info')
  const [showHealthForm, setShowHealthForm] = useState(false)
  const [showMovementForm, setShowMovementForm] = useState(false)
  const [showApplyProtocol, setShowApplyProtocol] = useState(false)

  const tabs = baseTabs.filter(t => !t.adminOnly || isAdmin)

  const primaryPhoto = photos.find((p) => p.is_primary) || photos[0] || null
  const displayPhotoUrl = primaryPhoto?.url || animal.photo_url || null

  const counts: Record<string, number> = {
    photos: photos.length || (animal.photo_url ? 1 : 0),
    healthRecords: healthRecords.length,
    movements: movements.length,
    outings: outings.length,
    socialPosts: socialPosts.length,
    icadDeclarations: icadDeclarations.length,
    fosterContracts: fosterContracts.length,
    activityLogs: activityLogs.length,
  }

  const todayDate = new Date()
  const today = todayDate.toISOString().split('T')[0]
  const futureDate = new Date(todayDate)
  futureDate.setDate(futureDate.getDate() + 30)
  const in30Days = futureDate.toISOString().split('T')[0]

  return (
    <div className="space-y-0">
      {/* Photo + quick info */}
      <div className="flex gap-5 mb-6">
        <div className="relative w-40 h-40 rounded-xl overflow-hidden border border-border bg-surface-dark flex-shrink-0">
          {displayPhotoUrl ? (
            <Image
              src={displayPhotoUrl}
              alt={animal.name}
              fill
              unoptimized={displayPhotoUrl.includes('hunimalis.com')}
              className="object-cover"
              sizes="160px"
            />
          ) : (
            <div className="flex items-center justify-center h-full w-full">
              <ImageIcon className="w-10 h-10 text-muted/30" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted flex-wrap">
          {animal.color && <span>{animal.color}</span>}
          {animal.weight && <span>{animal.weight} kg</span>}
          {animal.sterilized && (
            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-success/15 text-success">
              Sterilise(e)
            </span>
          )}
          {animal.behavior_score != null && (
            <span className="text-xs">Comportement : {animal.behavior_score}/5</span>
          )}
          {animal.box_id && boxes.length > 0 && (
            <span className="text-xs">
              Box : {boxes.find((b) => b.id === animal.box_id)?.name || '-'}
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border mb-6 overflow-x-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        <nav className="flex gap-0 -mb-px w-max min-w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const count = tab.countKey ? counts[tab.countKey] : undefined

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted hover:text-text'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {count !== undefined && (
                  <span className={`text-xs ${isActive ? 'text-primary/70' : 'text-muted/70'}`}>
                    ({count})
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'info' && (
          <InfoTab
            animal={animal}
            boxes={boxes}
            canManageAnimals={canManageAnimals}
          />
        )}

        {activeTab === 'photos' && (
          <PhotosTab
            animal={animal}
            photos={photos}
            canManageAnimals={canManageAnimals}
          />
        )}

        {activeTab === 'health' && (
          <HealthTab
            animal={animal}
            healthRecords={healthRecords}
            treatments={treatments}
            canManageHealth={canManageHealth}
            showForm={showHealthForm}
            onToggleForm={() => setShowHealthForm(!showHealthForm)}
            onApplyProtocol={() => setShowApplyProtocol(true)}
            hasProtocols={healthProtocols.length > 0}
            today={today}
            in30Days={in30Days}
          />
        )}

        {showApplyProtocol && (
          <ApplyProtocolModal
            animalId={animal.id}
            animalSpecies={animal.species}
            protocols={healthProtocols}
            onClose={() => setShowApplyProtocol(false)}
          />
        )}

        {activeTab === 'movements' && (
          <MovementsTab
            animal={animal}
            movements={movements}
            userNames={userNames}
            canManageMovements={canManageMovements}
            showForm={showMovementForm}
            onToggleForm={() => setShowMovementForm(!showMovementForm)}
          />
        )}

        {activeTab === 'foster' && (
          <FosterContractsTab
            animalId={animal.id}
            contracts={fosterContracts}
            canManage={canManageAnimals}
          />
        )}

        {activeTab === 'documents' && (
          <AnimalAttachmentsSection animalId={animal.id} canManage={canManageAnimals} />
        )}

        {activeTab === 'outings' && (
          <OutingsTab outings={outings} userNames={userNames} />
        )}

        {activeTab === 'posts' && (
          <PostsTab
            animal={animal}
            photos={photos}
            socialPosts={socialPosts}
            establishmentName={establishmentName}
            establishmentPhone={establishmentPhone}
            canManagePosts={canManagePosts}
          />
        )}

        {activeTab === 'icad' && (
          <IcadDeclarations
            animalId={animal.id}
            animalName={animal.name}
            chipNumber={animal.chip_number}
            declarations={icadDeclarations}
            canManage={canManageMovements}
          />
        )}

        {activeTab === 'activity' && isAdmin && (
          <ActivityTimeline logs={activityLogs} userNames={userNames} />
        )}
      </div>
    </div>
  )
}

/* ============================================================
   Tab 1: Infos
   ============================================================ */

function InfoTab({
  animal,
  boxes,
  canManageAnimals,
}: Readonly<{
  animal: Animal
  boxes: Box[]
  canManageAnimals: boolean
}>) {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left column */}
      <div className="space-y-4">
        <AnimalIdentificationCard animal={animal} />

        {/* Physical info card */}
        <div className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-muted" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Informations physiques</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Sexe</span>
              <span className="font-medium">{getSexLabel(animal.sex)}</span>
            </div>
            {animal.color && (
              <div className="flex justify-between">
                <span className="text-muted">Couleur / Robe</span>
                <span className="font-medium">{animal.color}</span>
              </div>
            )}
            {animal.weight != null && (
              <div className="flex justify-between">
                <span className="text-muted">Poids</span>
                <span className="font-medium">{animal.weight} kg</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted">Sterilise(e)</span>
              <span className={`font-medium ${animal.sterilized ? 'text-success' : 'text-muted'}`}>
                {animal.sterilized ? 'Oui' : 'Non'}
              </span>
            </div>
            {animal.behavior_score != null && (
              <div className="flex justify-between">
                <span className="text-muted">Score comportemental</span>
                <span className="font-medium">{animal.behavior_score}/5</span>
              </div>
            )}
          </div>
        </div>

        {/* Origin / Capture card */}
        {animal.capture_location && (
          <div className="bg-surface rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-muted" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Origine / Capture</h3>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-medium">{animal.capture_location}</p>
              {animal.capture_circumstances && (
                <p className="text-muted p-2 bg-surface-dark rounded-lg text-xs">
                  {animal.capture_circumstances}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right column */}
      <div className="space-y-4">
        {/* Description externe (publique) */}
        {animal.description_external && (
          <div className="bg-surface rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-muted" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Description</h3>
            </div>
            <p className="text-sm text-muted whitespace-pre-wrap">{animal.description_external}</p>
          </div>
        )}

        {/* Description interne (staff uniquement) */}
        {canManageAnimals && animal.description && (
          <div className="bg-surface rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-muted" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Notes internes</h3>
            </div>
            <p className="text-sm text-muted whitespace-pre-wrap">{animal.description}</p>
          </div>
        )}

        {/* Edit form (collapsible) */}
        {canManageAnimals && (
          <details className="bg-surface rounded-xl border border-border">
            <summary className="p-5 cursor-pointer font-medium text-muted hover:text-text transition-colors flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              Modifier l&apos;animal
            </summary>
            <div className="px-5 pb-5">
              <AnimalForm animal={animal} boxes={boxes} />
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   Tab 2: Photos
   ============================================================ */

function PhotosTab({
  animal,
  photos,
  canManageAnimals,
}: Readonly<{
  animal: Animal
  photos: AnimalPhoto[]
  canManageAnimals: boolean
}>) {
  return (
    <div className="max-w-2xl">
      <AnimalPhotos animalId={animal.id} photos={photos} canManage={canManageAnimals} fallbackPhotoUrl={animal.photo_url} />
    </div>
  )
}

/* ============================================================
   Tab 3: Sante
   ============================================================ */

function HealthTab({
  animal,
  healthRecords,
  treatments,
  canManageHealth,
  showForm,
  onToggleForm,
  onApplyProtocol,
  hasProtocols,
  today,
  in30Days,
}: Readonly<{
  animal: Animal
  healthRecords: AnimalHealthRecord[]
  treatments: AnimalTreatment[]
  canManageHealth: boolean
  showForm: boolean
  onToggleForm: () => void
  onApplyProtocol: () => void
  hasProtocols: boolean
  today: string
  in30Days: string
}>) {
  const activeTreatments = treatments.filter((t) => t.active)
  const stoppedTreatments = treatments.filter((t) => !t.active)

  const frequencyLabels: Record<string, string> = {
    daily: 'Quotidien',
    twice_daily: '2x/jour',
    weekly: 'Hebdo',
    custom: 'Personnalise',
  }

  return (
    <div className="space-y-4">
      {/* Identification card en haut de l'espace sante (acces vetos / soigneurs) */}
      <AnimalIdentificationCard animal={animal} />

      {/* Add buttons */}
      {canManageHealth && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleForm}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold gradient-primary text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            {showForm ? 'Masquer le formulaire' : 'Ajouter un acte'}
          </button>
          <button
            type="button"
            onClick={onApplyProtocol}
            disabled={!hasProtocols}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-border hover:bg-surface-hover transition-colors disabled:opacity-50"
            title={hasProtocols ? 'Appliquer un protocole de soins' : 'Aucun protocole defini'}
          >
            <ListChecks className="w-4 h-4" />
            Appliquer un protocole
          </button>
        </div>
      )}

      {/* Certificates */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Certificats à imprimer
        </h3>
        <p className="text-xs text-muted mb-3">
          Documents générés à partir des informations enregistrées sur l&apos;animal et des actes vétérinaires.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/pdf/animal/${animal.id}/medical-followup`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-border hover:bg-surface-hover transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Fiche de suivi médical
          </a>
          <a
            href={`/api/pdf/animal/${animal.id}/sterilization`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-border hover:bg-surface-hover transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Certificat de stérilisation
          </a>
          <a
            href={`/api/pdf/animal/${animal.id}/cession`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-border hover:bg-surface-hover transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Certificat avant cession
          </a>
        </div>
      </div>

      {/* Health record form */}
      {showForm && canManageHealth && (
        <HealthRecordForm
          animalId={animal.id}
          onClose={onToggleForm}
        />
      )}

      {/* Active treatments */}
      {activeTreatments.length > 0 && (
        <div className="bg-surface rounded-xl border border-border">
          <div className="p-5 border-b border-border flex items-center gap-2">
            <Pill className="w-4 h-4 text-primary" />
            <div>
              <h3 className="font-semibold">Traitements en cours</h3>
              <p className="text-xs text-muted mt-0.5">{activeTreatments.length} traitement(s) actif(s)</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {activeTreatments.map((t) => (
              <AnimalTreatmentRow key={t.id} treatment={t} frequencyLabels={frequencyLabels} canManage={canManageHealth} />
            ))}
          </div>
        </div>
      )}

      {/* Stopped treatments */}
      {stoppedTreatments.length > 0 && (
        <div className="bg-surface rounded-xl border border-border opacity-60">
          <div className="p-5 border-b border-border flex items-center gap-2">
            <Pill className="w-4 h-4 text-muted" />
            <div>
              <h3 className="font-semibold text-muted">Traitements termines</h3>
              <p className="text-xs text-muted mt-0.5">{stoppedTreatments.length} traitement(s)</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {stoppedTreatments.map((t) => (
              <AnimalTreatmentRow key={t.id} treatment={t} frequencyLabels={frequencyLabels} canManage={false} />
            ))}
          </div>
        </div>
      )}

      {/* Health records timeline */}
      <div className="bg-surface rounded-xl border border-border">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-muted" />
          <div>
            <h3 className="font-semibold">Suivi sanitaire</h3>
            <p className="text-xs text-muted mt-0.5">{healthRecords.length} acte(s)</p>
          </div>
        </div>

        {healthRecords.length === 0 ? (
          <p className="p-5 text-sm text-muted text-center">Aucun acte sanitaire enregistre</p>
        ) : (
          <div className="divide-y divide-border">
            {healthRecords.map((hr) => {
              const isOverdue = hr.next_due_date && hr.next_due_date < today
              const isSoon = hr.next_due_date && !isOverdue && hr.next_due_date <= in30Days

              return (
                <div key={hr.id} className="p-4 hover:bg-surface-hover/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-info/15 text-info">
                          {getHealthTypeLabel(hr.type)}
                        </span>
                        <span className="text-xs text-muted">{formatDateShort(hr.date)}</span>
                      </div>
                      <p className="text-sm mt-1">{hr.description}</p>
                      {hr.veterinarian && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted">
                          <Stethoscope className="w-3 h-3" />
                          <span>{hr.veterinarian}</span>
                        </div>
                      )}
                      {hr.next_due_date && (
                        <div className={`flex items-center gap-1 mt-1 text-xs ${
                          (() => {
                            if (isOverdue) return 'text-error font-semibold'
                            if (isSoon) return 'text-warning'
                            return 'text-muted'
                          })()
                        }`}>
                          {isOverdue ? (
                            <AlertTriangle className="w-3 h-3" />
                          ) : (
                            <Calendar className="w-3 h-3" />
                          )}
                          <span>
                            Prochain : {formatDateShort(hr.next_due_date)}
                            {isOverdue && ' (en retard)'}
                          </span>
                        </div>
                      )}
                    </div>
                    {hr.cost != null && hr.cost > 0 && (
                      <span className="text-sm font-semibold text-nowrap">{formatCurrency(hr.cost)}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function AnimalTreatmentRow({
  treatment,
  frequencyLabels,
  canManage,
}: Readonly<{
  treatment: AnimalTreatment
  frequencyLabels: Record<string, string>
  canManage: boolean
}>) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleStop() {
    startTransition(async () => {
      const result = await stopTreatment(treatment.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Traitement arrete')
        router.refresh()
      }
    })
  }

  return (
    <div className="p-4 hover:bg-surface-hover/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{treatment.name}</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
              {frequencyLabels[treatment.frequency] || treatment.frequency}
            </span>
          </div>
          {treatment.description && (
            <p className="text-xs text-muted mt-1">{treatment.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(treatment.start_date).toLocaleDateString('fr-FR')}
              {treatment.end_date && ` — ${new Date(treatment.end_date).toLocaleDateString('fr-FR')}`}
            </span>
            {treatment.times.length > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {treatment.times.join(', ')}
              </span>
            )}
          </div>
        </div>
        {canManage && treatment.active && (
          <button
            onClick={handleStop}
            disabled={isPending}
            className="p-1.5 rounded-lg text-muted hover:text-warning hover:bg-warning/10 transition-colors disabled:opacity-50"
            title="Arreter le traitement"
          >
            <StopCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   Tab 4: Mouvements
   ============================================================ */

function MovementsTab({
  animal,
  movements,
  userNames,
  canManageMovements,
  showForm,
  onToggleForm,
}: Readonly<{
  animal: Animal
  movements: AnimalMovement[]
  userNames: Record<string, string>
  canManageMovements: boolean
  showForm: boolean
  onToggleForm: () => void
}>) {
  const movableStatuses: AnimalStatus[] = ['pound', 'shelter', 'foster_family', 'boarding', 'adopted', 'returned', 'transferred']
  const canAddMovement = canManageMovements && movableStatuses.includes(animal.status)

  return (
    <div className="space-y-4">
      {/* Add button */}
      {canAddMovement && (
        <div>
          <button
            type="button"
            onClick={onToggleForm}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold gradient-primary text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            {showForm ? 'Masquer le formulaire' : 'Enregistrer un mouvement'}
          </button>
        </div>
      )}

      {/* Movement form */}
      {showForm && canAddMovement && (
        <div className="bg-surface rounded-xl border border-border p-5">
          <MovementForm
            animalId={animal.id}
            currentStatus={animal.status}
            onClose={onToggleForm}
          />
        </div>
      )}

      {/* Movements table */}
      <div className="bg-surface rounded-xl border border-border">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-muted" />
          <div>
            <h3 className="font-semibold">Mouvements</h3>
            <p className="text-xs text-muted mt-0.5">{movements.length} mouvement(s)</p>
          </div>
        </div>

        {movements.length === 0 ? (
          <p className="p-5 text-sm text-muted text-center">Aucun mouvement enregistre</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-hover/50">
                  <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Personne</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.map((mv) => (
                  <tr key={mv.id} className="hover:bg-surface-hover/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{getMovementLabel(mv.type)}</td>
                    <td className="px-4 py-3 text-muted">{formatDateShort(mv.date)}</td>
                    <td className="px-4 py-3 text-muted">{mv.person_name || (mv.created_by && userNames[mv.created_by]) || '-'}</td>
                    <td className="px-4 py-3 text-muted text-xs max-w-xs truncate">{mv.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   Tab 5: Publications
   ============================================================ */

function PostsTab({
  animal,
  photos,
  socialPosts,
  establishmentName,
  establishmentPhone,
  canManagePosts,
}: Readonly<{
  animal: Animal
  photos: AnimalPhoto[]
  socialPosts: SocialPost[]
  establishmentName: string
  establishmentPhone: string
  canManagePosts: boolean
}>) {
  const [showGenerator, setShowGenerator] = useState(false)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const captureDate = animal.pound_entry_date
    ? new Date(animal.pound_entry_date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  const postTypeBadges: Record<string, string> = {
    search_owner: 'RECHERCHE PROPRIETAIRE',
    adoption: 'A L\'ADOPTION',
  }

  function handleStartEdit(post: SocialPost) {
    setEditingPostId(post.id)
    setEditContent(post.content)
  }

  function handleCancelEdit() {
    setEditingPostId(null)
    setEditContent('')
  }

  function handleSaveEdit(postId: string) {
    if (!editContent.trim()) return
    startTransition(async () => {
      const result = await updatePost(postId, { content: editContent.trim() })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Publication mise a jour')
        setEditingPostId(null)
        setEditContent('')
        router.refresh()
      }
    })
  }

  function handleDelete(postId: string) {
    if (!window.confirm('Supprimer cette publication ?')) return
    startTransition(async () => {
      const result = await deletePost(postId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Publication supprimee')
        router.refresh()
      }
    })
  }

  function handleCopy(content: string) {
    navigator.clipboard.writeText(content)
    toast.success('Texte copie dans le presse-papier')
  }

  return (
    <div className="space-y-6">
      {/* Generate button */}
      {canManagePosts && (
        <div>
          <button
            type="button"
            onClick={() => setShowGenerator(!showGenerator)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold gradient-primary text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            {showGenerator ? 'Masquer le generateur' : 'Nouveau post IA'}
          </button>
        </div>
      )}

      {/* Post generator */}
      {showGenerator && canManagePosts && (
        <PostGenerator
          animal={animal}
          photos={photos}
          establishmentName={establishmentName}
          establishmentPhone={establishmentPhone}
          onPostCreated={() => setShowGenerator(false)}
        />
      )}

      {/* Existing posts */}
      {socialPosts.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <Share2 className="w-8 h-8 text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-muted">Aucune publication generee</p>
        </div>
      ) : (
        <div className="space-y-8">
          {socialPosts.map((post) => {
            const photoUrl = post.photo_urls?.[0] || null
            const isEditing = editingPostId === post.id

            return (
              <div key={post.id} className="space-y-3">
                {/* Visual card */}
                <div className="mx-auto max-w-md">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface-dark shadow-xl">
                    {/* Photo background */}
                    {photoUrl ? (
                      <Image
                        src={photoUrl}
                        alt={animal.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 448px) 100vw, 448px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-surface-dark">
                        <Camera className="h-20 w-20 text-muted/20" />
                      </div>
                    )}

                    {/* Dark gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />

                    {/* Top branding + status */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex items-start justify-between">
                      <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md rounded-full px-3.5 py-1.5">
                        <div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center shrink-0">
                          <span className="text-white text-[7px] font-extrabold leading-none">SDA</span>
                        </div>
                        <span className="text-white text-xs font-bold tracking-wider uppercase">
                          {establishmentName}
                        </span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm ${
                        (() => {
                          if (post.status === 'draft') return 'bg-white/20 text-white'
                          if (post.status === 'published') return 'bg-success/80 text-white'
                          return 'bg-white/10 text-white/60'
                        })()
                      }`}>
                        {(() => {
                          if (post.status === 'draft') return 'Brouillon'
                          if (post.status === 'published') return 'Publie'
                          return 'Archive'
                        })()}
                      </span>
                    </div>

                    {/* Bottom content */}
                    <div className="absolute bottom-0 left-0 right-0 p-5 space-y-2.5">
                      {/* Type badge */}
                      <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/80 text-white backdrop-blur-sm">
                        {postTypeBadges[post.type] || post.type}
                      </span>

                      {/* Animal name */}
                      <h2 className="text-3xl font-extrabold text-white tracking-tight">
                        {animal.name}
                      </h2>

                      {/* Location & date */}
                      <div className="flex flex-wrap gap-3 text-white/80 text-sm">
                        {animal.capture_location && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            {animal.capture_location}
                          </span>
                        )}
                        {captureDate && (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            {captureDate}
                          </span>
                        )}
                      </div>

                      {/* Text preview */}
                      <p className="text-white/90 text-sm leading-relaxed line-clamp-3">
                        {post.content}
                      </p>

                      {/* Footer */}
                      <div className="pt-2 border-t border-white/20 flex items-center gap-2 text-white/50 text-xs">
                        <span className="font-medium">{establishmentName}</span>
                        {establishmentPhone && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {establishmentPhone}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions & editor below the card */}
                <div className="mx-auto max-w-md space-y-3">
                  {isEditing ? (
                    <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={8}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(post.id)}
                          disabled={isPending || !editContent.trim()}
                          className="flex-1 gradient-primary hover:opacity-90 transition-opacity text-white px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Sauvegarder
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-3 py-2 rounded-lg text-sm font-medium text-muted border border-border hover:bg-surface-dark transition-colors flex items-center gap-2"
                        >
                          <X className="w-4 h-4" />
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      {canManagePosts && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(post)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted border border-border hover:bg-surface-dark hover:text-text transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(post.content)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted border border-border hover:bg-surface-dark hover:text-text transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copier
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(post.id)}
                            disabled={isPending}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted border border-border hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Supprimer
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Date & platform info */}
                  <p className="text-center text-xs text-muted">
                    Cree le {formatDateShort(post.created_at)}
                    {(() => {
                      if (post.platform === 'facebook') return ' · Facebook'
                      if (post.platform === 'instagram') return ' · Instagram'
                      return ' · FB + IG'
                    })()}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   Tab 6: Sorties
   ============================================================ */

function OutingsTab({
  outings,
  userNames,
}: Readonly<{
  outings: AnimalOuting[]
  userNames: Record<string, string>
}>) {
  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-border">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <Footprints className="w-4 h-4 text-muted" />
          <div>
            <h3 className="font-semibold">Historique des sorties</h3>
            <p className="text-xs text-muted mt-0.5">{outings.length} sortie(s)</p>
          </div>
        </div>

        {outings.length === 0 ? (
          <p className="p-5 text-sm text-muted text-center">Aucune sortie enregistree</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-hover/50">
                  <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Note</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Promene par</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Duree</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase tracking-wider">Commentaire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {outings.map((outing) => (
                  <tr key={outing.id} className="hover:bg-surface-hover/30 transition-colors">
                    <td className="px-4 py-3 text-muted">{formatDateShort(outing.started_at)}</td>
                    <td className="px-4 py-3">
                      {outing.rating != null ? (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-bold
                            ${(() => {
                              if (outing.rating! <= 3) return 'bg-red-500/15 text-red-400'
                              if (outing.rating! <= 5) return 'bg-orange-500/15 text-orange-400'
                              if (outing.rating! <= 7) return 'bg-yellow-500/15 text-yellow-400'
                              return 'bg-green-500/15 text-green-400'
                            })()
                            }`}
                          title={outing.rating_comment || undefined}
                        >
                          {outing.rating}/10
                        </span>
                      ) : (
                        <span className="text-muted text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {outing.is_tig ? (
                        <span className="inline-flex items-center gap-1">
                          <HardHat className="w-3.5 h-3.5 text-amber-500" />
                          <span className="font-medium text-amber-500">TIG</span>
                          {outing.tig_walker_name && (
                            <span className="text-xs"> — {outing.tig_walker_name}</span>
                          )}
                        </span>
                      ) : (
                        userNames[outing.walked_by] || 'Inconnu'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {outing.duration_minutes ? formatOutingDuration(outing.duration_minutes) : '-'}
                    </td>
                    <td className="px-4 py-3 text-muted text-xs max-w-[200px] truncate">
                      {outing.rating_comment || outing.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
