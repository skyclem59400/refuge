import Link from 'next/link'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import {
  ArrowLeft,
  AlertTriangle,
  MapPin,
  Camera,
  PawPrint,
  Tag,
  FileText,
  Users,
  ShieldAlert,
  Mail,
  Phone,
  User as UserIcon,
  Calendar,
  Activity,
  Workflow,
  Info,
  ExternalLink,
} from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getAbuseReport } from '@/lib/actions/abuse-reports'
import {
  ABUSE_TYPE_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  ANIMAL_TYPE_LABELS,
} from '@/lib/actions/abuse-reports-constants'
import { ResolveActions } from '@/components/abuse-reports/resolve-actions'
import { PortalAccountCard } from '@/components/portal-ticket/portal-account-card'
import { TicketTimeline } from '@/components/portal-ticket/ticket-timeline'
import { StaffMessageForm } from '@/components/portal-ticket/staff-message-form'
import type {
  AnimalCondition,
  AbuseReportStatus,
  AbuseSeverity,
} from '@/lib/types/database'

export const dynamic = 'force-dynamic'

const ANIMAL_CONDITION_LABELS: Record<AnimalCondition, string> = {
  alive_apparently_ok: 'Vivant — état apparent OK',
  injured: 'Blessé',
  dying: 'Agonisant',
  dead: 'Mort',
}

const PRIOR_ACTION_LABELS: Record<string, string> = {
  none: 'Aucune démarche',
  contacted_owner: 'Contacté le propriétaire',
  contacted_neighbors: 'Contacté les voisins',
  contacted_mairie: 'Contacté la mairie',
  contacted_gendarmerie: 'Contacté la gendarmerie/police',
  contacted_vet: 'Contacté un vétérinaire',
  contacted_association: 'Contacté une autre association',
  filed_complaint: 'Déposé plainte',
  other: 'Autre démarche',
}

const STATUS_BADGE: Record<AbuseReportStatus, string> = {
  new: 'bg-blue-500/15 text-blue-600',
  investigating: 'bg-amber-500/15 text-amber-700',
  transmitted_authorities: 'bg-purple-500/15 text-purple-700',
  on_site_intervention: 'bg-indigo-500/15 text-indigo-700',
  resolved: 'bg-emerald-500/15 text-emerald-700',
  unfounded: 'bg-slate-500/15 text-slate-500',
  archived: 'bg-slate-500/10 text-slate-400',
}

const SEVERITY_TEXT: Record<AbuseSeverity, string> = {
  urgent: 'text-red-700 dark:text-red-400',
  serious: 'text-orange-600 dark:text-orange-300',
  recurring: 'text-yellow-700 dark:text-yellow-300',
  suspicion: 'text-slate-500',
}

interface PageProps {
  params: Promise<{ id: string }>
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function fmtDateTime(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function AbuseReportDetailPage({ params }: PageProps) {
  const { id } = await params
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.permissions.canManageAbuseReports) {
    return (
      <div className="animate-fade-up p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Accès restreint</h1>
        <p className="text-sm text-muted">
          Vous n&apos;avez pas la permission de gérer les signalements de maltraitance.
        </p>
      </div>
    )
  }

  const { report, photos } = await getAbuseReport(id)
  if (!report) notFound()

  const fullAddress = [
    report.location_address,
    report.location_postal_code,
    report.location_city,
  ]
    .filter(Boolean)
    .join(', ')
  const mapUrl =
    report.location_latitude && report.location_longitude
      ? `https://www.google.com/maps?q=${report.location_latitude},${report.location_longitude}`
      : `https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}`

  const reporterFullName = [report.reporter_first_name, report.reporter_last_name]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="animate-fade-up max-w-6xl">
      <Link
        href="/admin/signalements-maltraitance"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la liste
      </Link>

      {/* Bandeau urgent */}
      {report.severity === 'urgent' && (
        <div className="mb-6 p-4 rounded-xl border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0 animate-pulse" />
          <div>
            <div className="font-semibold text-red-700 dark:text-red-300">
              ⚠ Cas urgent — réagir rapidement
            </div>
            <div className="text-xs text-red-600/80 dark:text-red-300/80">
              Le signalant a déclaré que la vie de l&apos;animal est en danger immédiat.
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h1 className="text-2xl font-bold font-mono">
              {report.ticket_number}
            </h1>
            <span className="text-lg text-muted">·</span>
            <h2 className="text-xl font-semibold">Signalement</h2>
          </div>
          <p className="text-sm text-muted">
            Reçu le {fmtDateTime(report.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[report.status]}`}
          >
            {STATUS_LABELS[report.status]}
          </span>
        </div>
      </div>

      <PortalAccountCard
        userId={report.user_id}
        ticketNumber={report.ticket_number}
        createdAt={report.created_at}
        statusLabel={STATUS_LABELS[report.status]}
        statusClassName={STATUS_BADGE[report.status]}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Colonne gauche */}
        <div className="lg:col-span-2 space-y-4">
          {/* Photos */}
          <Card icon={<Camera className="w-4 h-4 text-muted" />} title="Photos">
            {photos.length === 0 ? (
              <p className="text-sm text-muted italic">Aucune photo jointe.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((p) => (
                  <a
                    key={p.id}
                    href={p.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative aspect-square block rounded-lg overflow-hidden border border-border hover:opacity-90 transition-opacity bg-muted-bg"
                    title={p.original_filename || 'Photo'}
                  >
                    <Image
                      src={p.signedUrl}
                      alt={p.original_filename || 'Photo signalement'}
                      fill
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="object-cover"
                      unoptimized
                    />
                  </a>
                ))}
              </div>
            )}
            {photos.length > 0 && (
              <p className="text-xs text-muted mt-3 italic">
                Liens valides 60 secondes — rafraîchir la page pour les régénérer.
              </p>
            )}
          </Card>

          {/* Lieu */}
          <Card icon={<MapPin className="w-4 h-4 text-muted" />} title="Lieu">
            <div className="text-sm">
              <div className="font-medium">{report.location_address}</div>
              <div className="text-muted">
                {report.location_postal_code} {report.location_city}
              </div>
              {report.location_details && (
                <div className="mt-2 text-sm text-foreground/80 whitespace-pre-wrap">
                  <span className="text-xs uppercase tracking-wider text-muted block mb-1">
                    Précisions
                  </span>
                  {report.location_details}
                </div>
              )}
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary text-sm hover:underline mt-3"
              >
                Voir sur Google Maps <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </Card>

          {/* Animal */}
          <Card icon={<PawPrint className="w-4 h-4 text-muted" />} title="Animal(aux) concerné(s)">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Type</dt>
                <dd className="font-medium">{ANIMAL_TYPE_LABELS[report.animal_type]}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Nombre estimé</dt>
                <dd className="font-medium">{report.animal_count_estimate}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted uppercase tracking-wider">État apparent</dt>
                <dd className="font-medium">
                  {ANIMAL_CONDITION_LABELS[report.animal_condition]}
                </dd>
              </div>
            </dl>
          </Card>

          {/* Type de maltraitance */}
          <Card icon={<Tag className="w-4 h-4 text-muted" />} title="Type de maltraitance">
            {report.abuse_types.length === 0 ? (
              <p className="text-sm text-muted italic">Non précisé.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {report.abuse_types.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-md bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-semibold"
                  >
                    {ABUSE_TYPE_LABELS[t]}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* Description */}
          <Card icon={<FileText className="w-4 h-4 text-muted" />} title="Description">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {report.description || (
                <span className="italic text-muted">Aucune description fournie.</span>
              )}
            </p>
          </Card>

          {/* Témoins */}
          <Card icon={<Users className="w-4 h-4 text-muted" />} title="Témoins">
            <div className="text-sm">
              <div>
                <span className="text-xs text-muted uppercase tracking-wider mr-2">Témoins :</span>
                <span className="font-medium">{report.has_witnesses ? 'Oui' : 'Non'}</span>
              </div>
              {report.has_witnesses && report.witnesses_contact && (
                <div className="mt-2">
                  <div className="text-xs text-muted uppercase tracking-wider mb-1">
                    Contact des témoins
                  </div>
                  <div className="whitespace-pre-wrap">{report.witnesses_contact}</div>
                </div>
              )}
            </div>
          </Card>

          {/* Démarches déjà tentées */}
          <Card icon={<ShieldAlert className="w-4 h-4 text-muted" />} title="Démarches déjà tentées">
            {report.prior_actions.length === 0 ? (
              <p className="text-sm text-muted italic">Aucune démarche signalée.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {report.prior_actions.map((a) => (
                    <span
                      key={a}
                      className="px-2.5 py-1 rounded-md bg-muted-bg text-foreground/80 text-xs font-medium"
                    >
                      {PRIOR_ACTION_LABELS[a] || a}
                    </span>
                  ))}
                </div>
                {report.prior_actions_details && (
                  <div className="text-sm">
                    <div className="text-xs text-muted uppercase tracking-wider mb-1">
                      Détails
                    </div>
                    <p className="whitespace-pre-wrap">{report.prior_actions_details}</p>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        {/* Colonne droite */}
        <div className="space-y-4">
          {/* Signalant */}
          <Card icon={<UserIcon className="w-4 h-4 text-muted" />} title="Signalant">
            {report.reporter_is_anonymous ? (
              <div className="text-sm">
                <div className="font-medium mb-2">Signalant anonyme</div>
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                  <a
                    href={`mailto:${report.reporter_email}`}
                    className="text-primary hover:underline break-all"
                  >
                    {report.reporter_email}
                  </a>
                </div>
              </div>
            ) : (
              <dl className="space-y-2.5 text-sm">
                {reporterFullName && (
                  <div>
                    <dt className="text-xs text-muted uppercase tracking-wider">Nom</dt>
                    <dd className="font-medium">{reporterFullName}</dd>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                  <a
                    href={`mailto:${report.reporter_email}`}
                    className="text-primary hover:underline break-all"
                  >
                    {report.reporter_email}
                  </a>
                </div>
                {report.reporter_phone && (
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                    <a
                      href={`tel:${report.reporter_phone}`}
                      className="text-primary hover:underline"
                    >
                      {report.reporter_phone}
                    </a>
                  </div>
                )}
              </dl>
            )}
          </Card>

          {/* Dates d'observation */}
          <Card icon={<Calendar className="w-4 h-4 text-muted" />} title="Dates d'observation">
            <dl className="space-y-2.5 text-sm">
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Première observation</dt>
                <dd>{fmtDate(report.first_observed_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Dernière observation</dt>
                <dd>{fmtDate(report.last_observed_date)}</dd>
              </div>
            </dl>
          </Card>

          {/* Gravité */}
          <Card icon={<Activity className="w-4 h-4 text-muted" />} title="Gravité">
            <div className={`text-lg font-bold ${SEVERITY_TEXT[report.severity]}`}>
              {SEVERITY_LABELS[report.severity]}
            </div>
          </Card>

          {/* Consentement RGPD */}
          <Card icon={<ShieldAlert className="w-4 h-4 text-muted" />} title="Consentement RGPD">
            <div className="text-sm">
              <div className="text-xs text-muted uppercase tracking-wider mb-1">
                Transmission aux autorités
              </div>
              <div
                className={`font-semibold ${
                  report.consent_share_authorities
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-700 dark:text-red-400'
                }`}
              >
                {report.consent_share_authorities ? 'Autorisée' : 'Non autorisée'}
              </div>
            </div>
          </Card>

          {/* Workflow */}
          <Card icon={<Workflow className="w-4 h-4 text-muted" />} title="Workflow">
            <ResolveActions
              reportId={report.id}
              currentStatus={report.status}
              currentNotes={report.admin_notes}
              currentResolutionSummary={report.resolution_summary}
            />
            {report.resolved_at && (
              <div className="mt-4 pt-4 border-t border-border text-xs space-y-1">
                <div>
                  <span className="text-muted">Résolu le : </span>
                  <span className="font-medium">{fmtDateTime(report.resolved_at)}</span>
                </div>
                {report.resolved_by && (
                  <div>
                    <span className="text-muted">Par : </span>
                    <span className="font-medium">{report.resolved_by}</span>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Message au demandeur (uniquement si compte portail) */}
          {report.user_id && (
            <StaffMessageForm ticketType="abuse_report" ticketId={report.id} />
          )}

          {/* Timeline d'événements */}
          <TicketTimeline ticketType="abuse_report" ticketId={report.id} />

          {/* Metadata */}
          <Card icon={<Info className="w-4 h-4 text-muted" />} title="Metadata">
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-muted uppercase tracking-wider">Soumis le</dt>
                <dd className="font-mono">{fmtDateTime(report.created_at)}</dd>
              </div>
              <div>
                <dt className="text-muted uppercase tracking-wider">Source</dt>
                <dd className="font-mono">{report.source}</dd>
              </div>
              {report.ip_address && (
                <div>
                  <dt className="text-muted uppercase tracking-wider">IP</dt>
                  <dd className="font-mono">{report.ip_address}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
        {icon} {title}
      </h2>
      {children}
    </div>
  )
}
