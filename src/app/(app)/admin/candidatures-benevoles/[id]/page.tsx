import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  HandHeart,
  Mail,
  Phone,
  MapPin,
  Calendar,
  User,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Briefcase,
  HeartPulse,
  Cake,
  Info,
} from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getVolunteerApplication } from '@/lib/actions/volunteer-applications'
import {
  VOLUNTEER_STATUS_LABELS,
  VOLUNTEER_STATUS_CLASSES,
  VOLUNTEER_SKILL_LABELS,
  VOLUNTEER_DAY_LABELS,
  VOLUNTEER_SLOT_LABELS,
  VOLUNTEER_FREQUENCY_LABELS,
  VOLUNTEER_PHYSICAL_LABELS,
} from '@/lib/actions/volunteer-applications-constants'
import { ResolveActions } from '@/components/volunteer-applications/resolve-actions'
import { PortalAccountCard } from '@/components/portal-ticket/portal-account-card'
import { TicketTimeline } from '@/components/portal-ticket/ticket-timeline'
import { StaffMessageForm } from '@/components/portal-ticket/staff-message-form'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

const ORDERED_DAYS: Array<keyof typeof VOLUNTEER_DAY_LABELS> = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
]
const ORDERED_SLOTS: Array<keyof typeof VOLUNTEER_SLOT_LABELS> = [
  'morning',
  'afternoon',
  'evening',
]

export default async function CandidatureBenevoleDetailPage({ params }: PageProps) {
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
  if (!ctx.permissions.canManageVolunteerApplications) {
    return (
      <div className="animate-fade-up p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Accès restreint</h1>
        <p className="text-sm text-muted">
          Vous n&apos;avez pas la permission de gérer les candidatures bénévoles.
        </p>
      </div>
    )
  }

  const { application } = await getVolunteerApplication(id)
  if (!application) notFound()

  const fullName = `${application.first_name} ${application.last_name}`.trim()
  const age = computeAge(application.birth_date)

  return (
    <div className="animate-fade-up max-w-6xl">
      <Link
        href="/admin/candidatures-benevoles"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la liste
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <HandHeart className="w-6 h-6 text-primary" />
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
          className={`px-3 py-1 rounded-full text-xs font-semibold ${VOLUNTEER_STATUS_CLASSES[application.status]}`}
        >
          {VOLUNTEER_STATUS_LABELS[application.status]}
        </span>
      </div>

      <PortalAccountCard
        userId={application.user_id}
        ticketNumber={application.ticket_number}
        createdAt={application.created_at}
        statusLabel={VOLUNTEER_STATUS_LABELS[application.status]}
        statusClassName={VOLUNTEER_STATUS_CLASSES[application.status]}
      />

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

          {/* Disponibilités */}
          <section className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted" /> Disponibilités
            </h2>
            <AvailabilityMatrix
              days={application.availability?.days || []}
              slots={application.availability?.slots || []}
            />
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Fréquence</dt>
                <dd className="font-medium">
                  {application.availability?.frequency
                    ? VOLUNTEER_FREQUENCY_LABELS[application.availability.frequency] ??
                      application.availability.frequency
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Début souhaité</dt>
                <dd className="font-medium">
                  {application.availability?.start_date
                    ? new Date(application.availability.start_date).toLocaleDateString('fr-FR')
                    : '—'}
                </dd>
              </div>
            </dl>
          </section>

          {/* Compétences */}
          <section className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-muted" /> Compétences & intérêts
            </h2>
            {application.skills && application.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {application.skills.map((s) => (
                  <span
                    key={s}
                    className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium"
                  >
                    {VOLUNTEER_SKILL_LABELS[s] ?? s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm italic text-muted">Aucune compétence renseignée.</p>
            )}
          </section>

          {/* Aptitudes */}
          <section className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-muted" /> Aptitudes
            </h2>
            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Permis B</dt>
                <dd className="font-medium">
                  {application.has_driving_license ? 'Oui' : 'Non'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Capacité physique</dt>
                <dd className="font-medium">
                  {application.physical_capacity
                    ? VOLUNTEER_PHYSICAL_LABELS[application.physical_capacity] ?? application.physical_capacity
                    : '—'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted uppercase tracking-wider">Allergies</dt>
                <dd className="font-medium">
                  {application.has_allergies ? (
                    <>
                      Oui
                      {application.allergies_details && (
                        <span className="block text-xs text-muted font-normal mt-1">
                          {application.allergies_details}
                        </span>
                      )}
                    </>
                  ) : (
                    'Non'
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {/* Expérience préalable */}
          <section className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-muted" /> Expérience préalable
            </h2>
            {application.previous_experience ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {application.previous_experience}
              </p>
            ) : (
              <p className="text-sm italic text-muted">Aucune expérience renseignée.</p>
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
          <ResolveActions
            applicationId={application.id}
            currentStatus={application.status}
            currentNotes={application.admin_notes}
          />

          {/* Message au demandeur (uniquement si compte portail) */}
          {application.user_id && (
            <StaffMessageForm
              ticketType="volunteer"
              ticketId={application.id}
            />
          )}

          {/* Timeline d'événements */}
          <TicketTimeline ticketType="volunteer" ticketId={application.id} />

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

function AvailabilityMatrix({
  days,
  slots,
}: {
  days: string[]
  slots: string[]
}) {
  const daySet = new Set(days)
  const slotSet = new Set(slots)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-muted-bg">
            <th className="text-left px-3 py-2 font-medium text-muted"></th>
            {ORDERED_DAYS.map((d) => (
              <th
                key={d}
                className={`px-3 py-2 font-medium text-center ${
                  daySet.has(d) ? 'text-foreground' : 'text-muted'
                }`}
              >
                {VOLUNTEER_DAY_LABELS[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ORDERED_SLOTS.map((slot) => {
            const slotActive = slotSet.has(slot)
            return (
              <tr key={slot} className="border-t border-border">
                <td
                  className={`px-3 py-2 font-medium ${
                    slotActive ? 'text-foreground' : 'text-muted'
                  }`}
                >
                  {VOLUNTEER_SLOT_LABELS[slot]}
                </td>
                {ORDERED_DAYS.map((d) => {
                  const active = slotActive && daySet.has(d)
                  return (
                    <td
                      key={d}
                      className={`px-3 py-2 text-center ${
                        active
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold'
                          : 'bg-card text-muted'
                      }`}
                    >
                      {active ? '✓' : '·'}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
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
