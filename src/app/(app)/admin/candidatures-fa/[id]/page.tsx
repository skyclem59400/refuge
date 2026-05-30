import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Home,
  Mail,
  Phone,
  MapPin,
  Calendar,
  User,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Users,
  PawPrint,
  Cake,
  Info,
  Truck,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getFosterApplication } from '@/lib/actions/foster-applications'
import {
  FOSTER_STATUS_LABELS,
  FOSTER_STATUS_CLASSES,
  FOSTER_TYPE_LABELS,
  HOUSING_TYPE_LABELS,
} from '@/lib/actions/foster-applications-constants'
import { FosterResolveActions } from '@/components/foster-applications/resolve-actions'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CandidatureFADetailPage({ params }: PageProps) {
  const { id } = await params
  const ctx = await getEstablishmentContext()

  if (!ctx) {
    return (
      <div className="animate-fade-up p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Non authentifié</h1>
        <p className="text-sm text-muted">Veuillez vous connecter pour accéder à cette page.</p>
      </div>
    )
  }
  if (!ctx.permissions.canManageFosterApplications) {
    return (
      <div className="animate-fade-up p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Accès restreint</h1>
        <p className="text-sm text-muted">
          Vous n&apos;avez pas la permission de gérer les candidatures famille d&apos;accueil.
        </p>
      </div>
    )
  }

  const { application } = await getFosterApplication(id)
  if (!application) notFound()

  const fullName = `${application.first_name} ${application.last_name}`.trim()
  const age = computeAge(application.birth_date)

  return (
    <div className="animate-fade-up max-w-6xl">
      <Link
        href="/admin/candidatures-fa"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la liste
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <Home className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold font-mono">
              {application.ticket_number}
            </h1>
            <span className="text-lg text-muted">·</span>
            <h2 className="text-xl font-semibold">{fullName}</h2>
          </div>
          <p className="text-sm text-muted">
            Candidature reçue le{' '}
            {new Date(application.created_at).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${FOSTER_STATUS_CLASSES[application.status]}`}
        >
          {FOSTER_STATUS_LABELS[application.status]}
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Motivation */}
          <section className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-muted" /> Motivation
            </h2>
            {application.motivation ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{application.motivation}</p>
            ) : (
              <p className="text-sm italic text-muted">Aucune motivation renseignée.</p>
            )}
          </section>

          {/* Logement */}
          <section className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Home className="w-4 h-4 text-muted" /> Logement
            </h2>
            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Type</dt>
                <dd className="font-medium">
                  {application.housing_type
                    ? HOUSING_TYPE_LABELS[application.housing_type]
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Jardin / extérieur</dt>
                <dd className="font-medium flex items-center gap-1.5">
                  {application.has_garden ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Oui
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-stone-400" />
                      Non
                    </>
                  )}
                </dd>
                {application.garden_size_text && (
                  <span className="text-xs text-muted mt-0.5 block">
                    {application.garden_size_text}
                  </span>
                )}
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted uppercase tracking-wider">Pièce dédiée pour l&apos;accueil</dt>
                <dd className="font-medium flex items-center gap-1.5">
                  {application.has_separate_room ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Oui
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-stone-400" /> Non
                    </>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {/* Foyer */}
          <section className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-muted" /> Foyer
            </h2>
            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Personnes au foyer</dt>
                <dd className="font-medium">{application.household_size}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Enfants</dt>
                <dd className="font-medium">
                  {application.has_children ? 'Oui' : 'Non'}
                </dd>
                {application.children_ages_text && (
                  <span className="text-xs text-muted mt-0.5 block">
                    Âges : {application.children_ages_text}
                  </span>
                )}
              </div>
              <div className="sm:col-span-2 flex items-start gap-2">
                {application.household_agreement ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                )}
                <span className="text-sm">
                  Accord de tous les membres du foyer :{' '}
                  <span className="font-medium">
                    {application.household_agreement ? 'Confirmé' : 'Non confirmé'}
                  </span>
                </span>
              </div>
            </dl>
          </section>

          {/* Animaux personnels */}
          <section className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <PawPrint className="w-4 h-4 text-muted" /> Animaux personnels
            </h2>
            {application.has_pets ? (
              <div className="space-y-2 text-sm">
                <p className="leading-relaxed whitespace-pre-wrap">
                  {application.pets_details || (
                    <span className="italic text-muted">Pas de précisions.</span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  Vaccins à jour :{' '}
                  <span className="font-medium text-foreground">
                    {application.pets_vaccinated === true
                      ? 'Oui'
                      : application.pets_vaccinated === false
                        ? 'Non'
                        : 'Inconnu'}
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-sm italic text-muted">
                Pas d&apos;animaux personnels au foyer.
              </p>
            )}
          </section>

          {/* Disponibilité */}
          <section className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted" /> Disponibilité d&apos;accueil
            </h2>
            <dl className="grid sm:grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Disponible à partir de</dt>
                <dd className="font-medium">
                  {application.available_from
                    ? new Date(application.available_from).toLocaleDateString('fr-FR')
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Durée max</dt>
                <dd className="font-medium">
                  {application.max_duration_weeks
                    ? `${application.max_duration_weeks} semaines`
                    : '—'}
                </dd>
              </div>
              <div className="sm:col-span-2 flex items-start gap-2">
                <Truck className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                <span>
                  Transport vétérinaire :{' '}
                  <span className="font-medium">
                    {application.transport_available ? 'Oui' : 'Non'}
                  </span>
                </span>
              </div>
            </dl>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider mb-2">
                Types d&apos;accueil envisagés
              </dt>
              {application.can_foster_types && application.can_foster_types.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {application.can_foster_types.map((t) => (
                    <span
                      key={t}
                      className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium"
                    >
                      {FOSTER_TYPE_LABELS[t] ?? t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm italic text-muted">—</p>
              )}
            </div>
          </section>

          {/* Expérience préalable */}
          <section className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-muted" /> Expérience préalable
            </h2>
            {application.prior_foster_experience ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium">Déjà famille d&apos;accueil</p>
                {application.prior_experience_details && (
                  <p className="leading-relaxed whitespace-pre-wrap text-stone-700">
                    {application.prior_experience_details}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm italic text-muted">Pas d&apos;expérience préalable déclarée.</p>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Contact */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-muted" /> Contact
            </h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                <a
                  href={`mailto:${application.email}`}
                  className="text-primary hover:underline break-all"
                >
                  {application.email}
                </a>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                <a href={`tel:${application.phone}`} className="text-primary hover:underline">
                  {application.phone}
                </a>
              </div>
              {application.birth_date && (
                <div className="flex items-start gap-2">
                  <Cake className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                  <span>
                    {new Date(application.birth_date).toLocaleDateString('fr-FR')}
                    {age !== null && (
                      <span className="text-muted"> ({age} ans)</span>
                    )}
                  </span>
                </div>
              )}
              {application.profession && (
                <div className="flex items-start gap-2">
                  <span className="text-xs uppercase tracking-wider text-muted mt-0.5 shrink-0 w-12">Métier</span>
                  <span className="font-medium">{application.profession}</span>
                </div>
              )}
              {(application.address || application.city || application.postal_code) && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                  <span>
                    {application.address && <>{application.address}<br /></>}
                    {[application.postal_code, application.city].filter(Boolean).join(' ')}
                  </span>
                </div>
              )}
            </dl>
          </div>

          {/* Engagement */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-muted" /> Engagement
            </h2>
            <div className="flex items-start gap-2 text-sm">
              {application.clean_record_declared ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              )}
              <span>
                Casier judiciaire :{' '}
                <span className="font-medium">
                  {application.clean_record_declared
                    ? 'Vierge déclaré'
                    : 'Non déclaré comme vierge'}
                </span>
              </span>
            </div>
          </div>

          {/* Workflow */}
          <FosterResolveActions
            applicationId={application.id}
            currentStatus={application.status}
            currentNotes={application.admin_notes}
          />

          {/* Metadata */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-muted" /> Métadonnées
            </h2>
            <dl className="space-y-2.5 text-sm">
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Soumis le</dt>
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
                  <dt className="text-xs text-muted uppercase tracking-wider">IP</dt>
                  <dd className="font-mono text-xs">{application.ip_address}</dd>
                </div>
              )}
              {application.qualified_at && (
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wider">Qualifiée le</dt>
                  <dd>
                    {new Date(application.qualified_at).toLocaleDateString('fr-FR', {
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

function computeAge(birthDate: string | null): number | null {
  if (!birthDate) return null
  const bd = new Date(birthDate)
  if (Number.isNaN(bd.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - bd.getFullYear()
  const m = today.getMonth() - bd.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--
  return age >= 0 ? age : null
}
