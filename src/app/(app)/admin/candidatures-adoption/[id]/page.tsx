import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getAdoptionApplication } from '@/lib/actions/adoption-applications'
import { ResolveActions } from '@/components/adoption-applications/resolve-actions'
import { PortalAccountCard } from '@/components/portal-ticket/portal-account-card'
import { TicketTimeline } from '@/components/portal-ticket/ticket-timeline'
import { StaffMessageForm } from '@/components/portal-ticket/staff-message-form'
import type { AdoptionInquiryStatus } from '@/lib/types/database'
import {
  ArrowLeft,
  ClipboardCheck,
  Mail,
  Phone,
  MapPin,
  User,
  Clock,
  AlertTriangle,
  Home,
  PawPrint,
  Heart,
  ShieldCheck,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_META: Record<AdoptionInquiryStatus, { label: string; className: string }> = {
  pending: { label: 'À traiter', className: 'bg-amber-500/15 text-amber-700' },
  qualified: { label: 'Qualifiée', className: 'bg-blue-500/15 text-blue-600' },
  interview_scheduled: { label: 'Entretien planifié', className: 'bg-indigo-500/15 text-indigo-600' },
  accepted: { label: 'Acceptée', className: 'bg-emerald-500/15 text-emerald-700' },
  declined: { label: 'Refusée', className: 'bg-red-500/15 text-red-700' },
  archived: { label: 'Archivée', className: 'bg-slate-500/15 text-slate-500' },
}

// Field label translations + value formatters keyed by questionnaire field.
const FIELD_LABELS: Record<string, string> = {
  // Foyer
  household_size: 'Nombre de personnes au foyer',
  household_adults: 'Nombre d’adultes',
  household_children: 'Nombre d’enfants',
  children_ages: 'Âges des enfants',
  household_agreement: 'Tout le foyer est d’accord',
  // Logement
  housing_type: 'Type de logement',
  logement_type: 'Type de logement',
  housing_status: 'Statut d’occupation',
  owner_or_tenant: 'Propriétaire ou locataire',
  landlord_authorization: 'Autorisation du propriétaire',
  garden: 'Jardin',
  has_garden: 'Jardin',
  garden_size: 'Surface du jardin',
  garden_fenced: 'Jardin clôturé',
  fence_height: 'Hauteur de la clôture',
  // Animaux & expérience
  current_animals: 'Animaux déjà présents',
  past_animals: 'Animaux passés',
  experience_years: "Années d'expérience",
  experience: 'Expérience animale',
  vet_referent: 'Vétérinaire référent',
  // Animal souhaité
  desired_species: 'Espèce souhaitée',
  desired_breed: 'Race souhaitée',
  desired_age: 'Âge souhaité',
  desired_sex: 'Sexe souhaité',
  desired_temperament: 'Tempérament recherché',
  ok_with_children: 'OK avec enfants',
  ok_with_other_animals: 'OK avec autres animaux',
  // Engagement
  daily_time: 'Temps disponible chaque jour',
  vacation_arrangement: 'Garde pendant les vacances',
  budget_monthly: 'Budget mensuel',
  budget_emergency: 'Budget vétérinaire d’urgence',
  long_term_commitment: 'Engagement long terme',
  // Motivation
  motivation: 'Motivation',
  why_adoption: 'Pourquoi l’adoption',
  why_this_shelter: 'Pourquoi notre refuge',
  expectations: 'Attentes',
  comments: 'Commentaires',
}

// Logical groupings — keys checked in order, only display sections that have content.
const SECTIONS: { title: string; Icon: typeof Home; fields: string[] }[] = [
  {
    title: 'Foyer',
    Icon: User,
    fields: ['household_size', 'household_adults', 'household_children', 'children_ages', 'household_agreement'],
  },
  {
    title: 'Logement',
    Icon: Home,
    fields: [
      'housing_type',
      'logement_type',
      'housing_status',
      'owner_or_tenant',
      'landlord_authorization',
      'garden',
      'has_garden',
      'garden_size',
      'garden_fenced',
      'fence_height',
    ],
  },
  {
    title: 'Expérience animale',
    Icon: PawPrint,
    fields: ['current_animals', 'past_animals', 'experience_years', 'experience', 'vet_referent'],
  },
  {
    title: 'Animal souhaité',
    Icon: Heart,
    fields: [
      'desired_species',
      'desired_breed',
      'desired_age',
      'desired_sex',
      'desired_temperament',
      'ok_with_children',
      'ok_with_other_animals',
    ],
  },
  {
    title: 'Engagement',
    Icon: ShieldCheck,
    fields: ['daily_time', 'vacation_arrangement', 'budget_monthly', 'budget_emergency', 'long_term_commitment'],
  },
  {
    title: 'Motivation',
    Icon: ClipboardCheck,
    fields: ['motivation', 'why_adoption', 'why_this_shelter', 'expectations', 'comments'],
  },
]

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CandidatureAdoptionDetailPage({ params }: PageProps) {
  const { id } = await params
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')

  if (!ctx.permissions.canManageAdoptionApplications) {
    return (
      <div className="animate-fade-up p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Accès restreint</h1>
        <p className="text-sm text-muted">
          Cette section est réservée aux membres habilités à gérer les candidatures d&apos;adoption.
        </p>
      </div>
    )
  }

  const { data: application } = await getAdoptionApplication(id)
  if (!application) notFound()

  const fullName = `${application.first_name} ${application.last_name}`.trim() || 'Candidat·e'
  const statusMeta = STATUS_META[application.status]
  const questionnaire = application.questionnaire ?? {}
  const usedKeys = new Set<string>()

  // Compute sections that have any populated field
  const renderedSections = SECTIONS.map((section) => {
    const items = section.fields
      .filter((f) => isMeaningful(questionnaire[f]))
      .map((f) => {
        usedKeys.add(f)
        return { key: f, label: FIELD_LABELS[f] ?? humanize(f), value: questionnaire[f] }
      })
    return { ...section, items }
  }).filter((s) => s.items.length > 0)

  // Catch-all : remaining fields not in any predefined section
  const extras = Object.entries(questionnaire)
    .filter(([k, v]) => !usedKeys.has(k) && isMeaningful(v))
    .map(([k, v]) => ({ key: k, label: FIELD_LABELS[k] ?? humanize(k), value: v }))

  return (
    <div className="animate-fade-up max-w-6xl">
      <Link
        href="/admin/candidatures-adoption"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la liste
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <ClipboardCheck className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold font-mono">
              {application.ticket_number}
            </h1>
            <span className="text-lg text-muted">·</span>
            <h2 className="text-xl font-semibold">{fullName}</h2>
            {application.possible_blacklist_match && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-700">
                <AlertTriangle className="w-3.5 h-3.5" /> Liste noire potentielle
              </span>
            )}
          </div>
          <p className="text-sm text-muted">
            Candidature soumise le{' '}
            {new Date(application.created_at).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusMeta.className}`}>
          {statusMeta.label}
        </span>
      </div>

      <PortalAccountCard
        userId={application.user_id}
        ticketNumber={application.ticket_number}
        createdAt={application.created_at}
        statusLabel={statusMeta.label}
        statusClassName={statusMeta.className}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Questionnaire */}
        <div className="lg:col-span-2 space-y-4">
          {renderedSections.length === 0 && extras.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center text-sm text-muted">
              Aucune réponse au questionnaire.
            </div>
          ) : (
            <>
              {renderedSections.map((section) => {
                const Icon = section.Icon
                return (
                  <div key={section.title} className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="px-5 py-3 border-b border-border bg-muted-bg/50 flex items-center gap-2">
                      <Icon className="w-4 h-4 text-primary" />
                      <h2 className="font-semibold text-sm">{section.title}</h2>
                    </div>
                    <dl className="divide-y divide-border">
                      {section.items.map((item) => (
                        <div key={item.key} className="px-5 py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <dt className="text-xs text-muted uppercase tracking-wider font-medium sm:col-span-1">
                            {item.label}
                          </dt>
                          <dd className="text-sm sm:col-span-2 whitespace-pre-wrap break-words">
                            {formatValue(item.value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )
              })}

              {extras.length > 0 && (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="px-5 py-3 border-b border-border bg-muted-bg/50">
                    <h2 className="font-semibold text-sm">Autres réponses</h2>
                  </div>
                  <dl className="divide-y divide-border">
                    {extras.map((item) => (
                      <div key={item.key} className="px-5 py-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <dt className="text-xs text-muted uppercase tracking-wider font-medium sm:col-span-1">
                          {item.label}
                        </dt>
                        <dd className="text-sm sm:col-span-2 whitespace-pre-wrap break-words">
                          {formatValue(item.value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Contact */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-muted" /> Contact
            </h2>
            <dl className="space-y-2.5 text-sm">
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Nom</dt>
                <dd className="font-medium">{fullName}</dd>
              </div>
              {application.email && (
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                  <a
                    href={`mailto:${application.email}`}
                    className="text-primary hover:underline break-all"
                  >
                    {application.email}
                  </a>
                </div>
              )}
              {application.phone && (
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                  <a href={`tel:${application.phone}`} className="text-primary hover:underline">
                    {application.phone}
                  </a>
                </div>
              )}
              {(application.address || application.postal_code || application.city) && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                  <span className="whitespace-pre-line">
                    {[application.address, [application.postal_code, application.city].filter(Boolean).join(' ')]
                      .filter(Boolean)
                      .join('\n')}
                  </span>
                </div>
              )}
            </dl>
          </div>

          {/* Workflow */}
          <ResolveActions
            applicationId={application.id}
            currentStatus={application.status}
            currentNotes={application.team_notes}
          />

          {/* Message au demandeur (uniquement si compte portail) */}
          {application.user_id && (
            <StaffMessageForm
              ticketType="adoption"
              ticketId={application.id}
            />
          )}

          {/* Timeline d'événements */}
          <TicketTimeline ticketType="adoption" ticketId={application.id} />

          {/* Refusal reason — visible only if declined */}
          {application.status === 'declined' && application.refusal_reason && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="font-semibold text-sm mb-2 text-red-700">Motif de refus</h2>
              <p className="text-sm whitespace-pre-wrap">{application.refusal_reason}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted" /> Suivi
            </h2>
            <dl className="space-y-2.5 text-sm">
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Soumise le</dt>
                <dd>
                  {new Date(application.created_at).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Source</dt>
                <dd className="font-mono text-xs">{application.source || '—'}</dd>
              </div>
              {application.ip_address && (
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wider">Adresse IP</dt>
                  <dd className="font-mono text-xs">{application.ip_address}</dd>
                </div>
              )}
              {application.updated_at && application.updated_at !== application.created_at && (
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wider">Mise à jour le</dt>
                  <dd>
                    {new Date(application.updated_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- helpers ------------------------------------------------------------

function isMeaningful(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v as object).length > 0
  return true
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') {
    const lower = v.toLowerCase()
    if (['true', 'yes', 'oui'].includes(lower)) return 'Oui'
    if (['false', 'no', 'non'].includes(lower)) return 'Non'
    return translateEnum(v)
  }
  if (Array.isArray(v)) {
    return v.map((x) => formatValue(x)).join(', ')
  }
  if (typeof v === 'object') {
    return JSON.stringify(v, null, 2)
  }
  return String(v)
}

function translateEnum(value: string): string {
  const map: Record<string, string> = {
    house: 'Maison',
    maison: 'Maison',
    apartment: 'Appartement',
    appartement: 'Appartement',
    studio: 'Studio',
    farm: 'Ferme',
    ferme: 'Ferme',
    owner: 'Propriétaire',
    proprietaire: 'Propriétaire',
    tenant: 'Locataire',
    locataire: 'Locataire',
    dog: 'Chien',
    chien: 'Chien',
    cat: 'Chat',
    chat: 'Chat',
    rabbit: 'Lapin',
    lapin: 'Lapin',
    male: 'Mâle',
    female: 'Femelle',
    any: 'Indifférent',
    young: 'Jeune',
    adult: 'Adulte',
    senior: 'Senior',
  }
  return map[value.toLowerCase()] ?? value
}

function humanize(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
}
