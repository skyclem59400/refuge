import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  MapPin,
  Mail,
  Phone,
  User,
  Building2,
  Calendar,
  Camera,
  Moon,
  AlertTriangle,
  Scale,
  HeartPulse,
} from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { TicketActions } from '@/components/astreinte/ticket-actions'
import { TicketNoteForm } from '@/components/astreinte/ticket-note-form'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = {
  divagation: 'Divagation',
  dangerous: 'Animal dangereux',
  requisition: 'Réquisition judiciaire',
  veterinary_emergency: 'Urgence vétérinaire',
}

const SPECIES_LABEL: Record<string, string> = {
  dog: 'Chien',
  cat: 'Chat',
  other: 'Autre',
  unknown: 'Indéterminé',
}

const SIZE_LABEL: Record<string, string> = {
  small: 'Petit',
  medium: 'Moyen',
  large: 'Grand',
  unknown: 'Indéterminé',
}

const AUTHORITY_LABEL: Record<string, string> = {
  gendarmerie: 'Gendarmerie',
  police_nationale: 'Police nationale',
  police_municipale: 'Police municipale',
  parquet: 'Parquet',
  mairie: 'Mairie',
  other: 'Autre',
}

const STATUS_LABEL: Record<string, string> = {
  new: 'Nouveau',
  acknowledged: 'Pris en charge',
  on_route: 'En route',
  on_site: 'Sur place',
  in_progress: 'En cours',
  completed: 'Clôturé',
  cancelled: 'Annulé',
}

const DECLARANT_TYPE_LABEL: Record<string, string> = {
  elected: 'Élu',
  municipal_agent: 'Agent municipal',
  law_enforcement: 'Force de l’ordre',
  veterinarian: 'Vétérinaire',
  other: 'Autre',
}

const DECLARANT_TYPE_COLOR: Record<string, string> = {
  elected: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  municipal_agent: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  law_enforcement: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  veterinarian: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  other: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  created: 'Ticket créé',
  acknowledged: 'Pris en charge',
  assigned: 'Attribué',
  status_changed: 'Statut modifié',
  priority_changed: 'Priorité modifiée',
  photo_added: 'Photo ajoutée',
  comment: 'Commentaire',
  on_route: 'En route',
  on_site: 'Sur place',
  completed: 'Clôturé',
  cancelled: 'Annulé',
  report_sent: 'Compte-rendu envoyé',
}

const STATUS_LABEL_FR: Record<string, string> = {
  new: 'Nouveau',
  acknowledged: 'Pris en charge',
  on_route: 'En route',
  on_site: 'Sur place',
  in_progress: 'En cours',
  completed: 'Clôturé',
  cancelled: 'Annulé',
}

const PRIORITY_LABEL_FR: Record<string, string> = {
  low: 'Faible',
  normal: 'Normale',
  high: 'Élevée',
  critical: 'Critique',
}

const OUTCOME_LABEL_FR: Record<string, string> = {
  animal_recovered: 'Animal pris en charge',
  not_found: 'Animal non trouvé',
  refused: 'Prise en charge refusée',
  deceased: 'Animal décédé',
  transferred_owner: 'Restitué au propriétaire',
  other: 'Autre',
}

const DESTINATION_LABEL_FR: Record<string, string> = {
  refuge_sda: 'Refuge SDA',
  veterinary: 'Vétérinaire',
  owner_returned: 'Restitué au propriétaire',
  euthanasia: 'Euthanasie',
  on_site_release: 'Relâché sur place',
  other: 'Autre',
}

function formatEventMessage(
  eventType: string,
  rawMessage: string | null,
  metadata: { from?: string; to?: string; assigned_to?: string } | null,
  performerName: string | null
): string {
  const statusEvents = ['acknowledged', 'on_route', 'on_site', 'completed', 'cancelled', 'status_changed']
  if (statusEvents.includes(eventType) && metadata?.from && metadata?.to) {
    const from = STATUS_LABEL_FR[metadata.from] ?? metadata.from
    const to = STATUS_LABEL_FR[metadata.to] ?? metadata.to
    return performerName
      ? `${from} → ${to} — par ${performerName}`
      : `${from} → ${to}`
  }
  if (eventType === 'priority_changed' && metadata?.from && metadata?.to) {
    return `Priorité : ${PRIORITY_LABEL_FR[metadata.from] ?? metadata.from} → ${PRIORITY_LABEL_FR[metadata.to] ?? metadata.to}`
  }
  if (eventType === 'assigned') {
    return performerName ? `Attribué à ${performerName}` : 'Attribué'
  }
  if (!rawMessage) return EVENT_TYPE_LABEL[eventType] ?? eventType
  // Fallback : remplacer les clés anglaises restantes par leurs libellés français
  return rawMessage
    .replace(/\bnew\b/g, 'Nouveau')
    .replace(/\backnowledged\b/g, 'Pris en charge')
    .replace(/\bon_route\b/g, 'En route')
    .replace(/\bon_site\b/g, 'Sur place')
    .replace(/\bin_progress\b/g, 'En cours')
    .replace(/\bcompleted\b/g, 'Clôturé')
    .replace(/\bcancelled\b/g, 'Annulé')
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params

  const ctx = await getEstablishmentContext()
  if (!ctx?.permissions.canManageAstreinte) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()

  const { data: ticket } = await admin
    .from('astreinte_tickets')
    .select('*')
    .eq('id', id)
    .single()

  if (!ticket) notFound()

  const [{ data: events }, { data: photos }, { data: commune }, { data: members }] =
    await Promise.all([
      admin
        .from('astreinte_ticket_events')
        .select('id, event_type, message, performed_by, created_at, visible_to_declarant, metadata')
        .eq('ticket_id', id)
        .order('created_at', { ascending: false }),
      admin
        .from('astreinte_ticket_photos')
        .select('id, storage_path, mime_type, uploaded_at')
        .eq('ticket_id', id)
        .order('uploaded_at', { ascending: true }),
      ticket.municipality_code_insee
        ? admin
            .from('astreinte_municipalities')
            .select('name, postal_codes, convention_status')
            .eq('code_insee', ticket.municipality_code_insee)
            .single()
        : Promise.resolve({ data: null }),
      // Membres assignables : agents d'astreinte uniquement
      admin
        .from('establishment_members')
        .select('user_id')
        .eq('establishment_id', ctx.establishment.id)
        .eq('is_astreinte_agent', true),
    ])

  // Photos signed URLs (1h)
  const photoUrls: { id: string; url: string }[] = []
  for (const p of photos ?? []) {
    const { data } = await admin.storage
      .from('astreinte-photos')
      .createSignedUrl(p.storage_path, 3600)
    if (data?.signedUrl) photoUrls.push({ id: p.id, url: data.signedUrl })
  }

  // Infos utilisateurs : noms via auth.users (RPC get_users_info si dispo)
  const userIds = Array.from(
    new Set(
      [
        ticket.assigned_to,
        ticket.acknowledged_by,
        ticket.on_route_by,
        ticket.on_site_by,
        ticket.completed_by,
        ...(events ?? []).map((e) => e.performed_by),
        ...(members ?? []).map((m) => m.user_id),
      ].filter((u): u is string => Boolean(u))
    )
  )

  const usersInfo: Record<string, { email: string; name: string | null }> = {}
  if (userIds.length > 0) {
    const { data: users } = await admin.rpc('get_users_info', { user_ids: userIds })
    for (const u of users ?? []) {
      usersInfo[u.id] = { email: u.email, name: u.full_name ?? null }
    }
  }

  const assignableMembers = (members ?? [])
    .map((m) => ({
      user_id: m.user_id,
      label: usersInfo[m.user_id]?.name ?? usersInfo[m.user_id]?.email ?? m.user_id,
    }))
    .filter((m) => m.label)

  const isUrgent = ticket.priority === 'critical' || ticket.priority === 'high'

  return (
    <div className="animate-fade-up">
      <Link
        href="/astreinte/tickets"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground mb-6"
      >
        <ArrowLeft size={14} />
        Retour aux tickets
      </Link>

      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <span className="font-mono text-xs font-bold">{ticket.ticket_number}</span>
            {ticket.is_night_intervention && (
              <span
                className="inline-flex items-center gap-1 text-xs text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded"
                title="Intervention nuit (22h-7h)"
              >
                <Moon size={12} />
                Nuit
              </span>
            )}
            {isUrgent && (
              <span className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded font-bold uppercase">
                <AlertTriangle size={12} />
                Priorité {ticket.priority === 'critical' ? 'critique' : 'élevée'}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {ticket.intervention_type === 'requisition' && (
              <Scale size={20} className="text-purple-600" />
            )}
            {ticket.intervention_type === 'veterinary_emergency' && (
              <HeartPulse size={20} className="text-red-600" />
            )}
            {TYPE_LABEL[ticket.intervention_type] ?? ticket.intervention_type}
          </h1>
          <div className="text-sm text-muted mt-1 flex items-center gap-2">
            <Calendar size={12} />
            Reçu le {formatDateLong(ticket.created_at)}
          </div>
        </div>

        <TicketActions
          ticketId={ticket.id}
          currentStatus={ticket.status}
          currentPriority={ticket.priority}
          currentAssignee={ticket.assigned_to}
          assignableMembers={assignableMembers}
          reportSentAt={ticket.report_sent_at ?? null}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-4">
          {/* Localisation */}
          <Card title="Localisation">
            <div className="flex items-start gap-3">
              <MapPin size={16} className="text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{ticket.location_address}</div>
                {commune?.name && (
                  <div className="text-xs text-muted mt-1">
                    Commune : <strong>{commune.name}</strong>
                    {commune.convention_status === 'active' && (
                      <span className="ml-2 inline-block px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-[10px] font-semibold uppercase">
                        Convention active
                      </span>
                    )}
                    {commune.convention_status === 'none' && (
                      <span className="ml-2 inline-block px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-[10px] font-semibold uppercase">
                        Sans convention
                      </span>
                    )}
                  </div>
                )}
                {ticket.location_lat && ticket.location_lng && (
                  <div className="flex gap-3 mt-2">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${ticket.location_lat},${ticket.location_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline font-mono"
                    >
                      Google Maps ↗
                    </a>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${ticket.location_lat}&mlon=${ticket.location_lng}#map=18/${ticket.location_lat}/${ticket.location_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline font-mono"
                    >
                      OpenStreetMap ↗
                    </a>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Animal */}
          <Card title="Animal">
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <KV
                k="Espèce"
                v={
                  ticket.animal_species === 'other' && ticket.animal_species_other
                    ? `Autre — ${ticket.animal_species_other}`
                    : SPECIES_LABEL[ticket.animal_species ?? 'unknown']
                }
              />
              <KV k="Nombre" v={String(ticket.animal_count ?? 1)} />
              {ticket.animal_size && <KV k="Taille" v={SIZE_LABEL[ticket.animal_size]} />}
              {ticket.animal_color && <KV k="Couleur" v={ticket.animal_color} />}
              {ticket.animal_breed && <KV k="Race" v={ticket.animal_breed} />}
              {ticket.animal_injured !== null && (
                <KV
                  k="Blessé"
                  v={ticket.animal_injured ? 'Oui' : 'Non'}
                  alert={ticket.animal_injured}
                />
              )}
              {ticket.animal_dangerous !== null && (
                <KV
                  k="Dangereux"
                  v={ticket.animal_dangerous ? 'Oui' : 'Non'}
                  alert={ticket.animal_dangerous}
                />
              )}
              {ticket.animal_owner_known !== null && (
                <KV
                  k="Propriétaire connu"
                  v={ticket.animal_owner_known ? 'Oui' : 'Non'}
                />
              )}
            </div>
          </Card>

          {/* Description */}
          {ticket.description && (
            <Card title="Description du déclarant">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {ticket.description}
              </p>
            </Card>
          )}

          {/* Réquisition */}
          {ticket.intervention_type === 'requisition' && (
            <Card title="Réquisition judiciaire" accent="purple">
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {ticket.requisition_authority && (
                  <KV
                    k="Autorité"
                    v={
                      AUTHORITY_LABEL[ticket.requisition_authority] ??
                      ticket.requisition_authority
                    }
                  />
                )}
                {ticket.requisition_officer_name && (
                  <KV k="Agent / officier" v={ticket.requisition_officer_name} />
                )}
                {ticket.requisition_pv_number && (
                  <KV k="N° PV" v={ticket.requisition_pv_number} />
                )}
                {ticket.requisition_judicial_grounds && (
                  <KV k="Motif" v={ticket.requisition_judicial_grounds} />
                )}
              </div>
            </Card>
          )}

          {/* Vétérinaire */}
          {ticket.intervention_type === 'veterinary_emergency' && (
            <Card title="Urgence vétérinaire" accent="red">
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {ticket.veterinary_clinic_name && (
                  <KV k="Cabinet" v={ticket.veterinary_clinic_name} />
                )}
                {ticket.veterinary_emergency_type && (
                  <KV k="Type d'urgence" v={ticket.veterinary_emergency_type} />
                )}
              </div>
            </Card>
          )}

          {/* Photos */}
          {photoUrls.length > 0 && (
            <Card
              title={
                <span className="flex items-center gap-2">
                  <Camera size={14} />
                  Photos ({photoUrls.length})
                </span>
              }
            >
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {photoUrls.map((p) => (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aspect-square bg-muted/10 rounded overflow-hidden border hover:border-primary transition"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </Card>
          )}

          {/* Note / commentaire */}
          <Card title="Ajouter une note">
            <TicketNoteForm ticketId={ticket.id} />
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Déclarant */}
          <Card title="Déclarant">
            <div className="space-y-3 text-sm">
              {/* Identité + type */}
              {ticket.declarant_name && (
                <div>
                  <div className="font-semibold text-base">{ticket.declarant_name}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {ticket.declarant_type && (
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          DECLARANT_TYPE_COLOR[ticket.declarant_type] ?? ''
                        }`}
                      >
                        {DECLARANT_TYPE_LABEL[ticket.declarant_type] ?? ticket.declarant_type}
                      </span>
                    )}
                    {ticket.declarant_role && (
                      <span className="text-xs text-muted">{ticket.declarant_role}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Organisation */}
              {(ticket.declarant_organization || ticket.declarant_unit) && (
                <div className="border-t pt-3">
                  {ticket.declarant_organization && (
                    <div className="flex items-start gap-2">
                      <Building2 size={14} className="text-muted mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium">{ticket.declarant_organization}</div>
                        {ticket.declarant_unit && (
                          <div className="text-xs text-muted">{ticket.declarant_unit}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Contacts */}
              <div className="border-t pt-3 space-y-1.5">
                {ticket.declarant_phone && (
                  <div className="flex items-start gap-2">
                    <Phone size={14} className="text-muted mt-0.5 flex-shrink-0" />
                    <a
                      href={`tel:${ticket.declarant_phone}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {ticket.declarant_phone}
                    </a>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Mail size={14} className="text-muted mt-0.5 flex-shrink-0" />
                  <a
                    href={`mailto:${ticket.declarant_email}`}
                    className="text-primary hover:underline break-all"
                  >
                    {ticket.declarant_email}
                  </a>
                </div>
              </div>
            </div>
          </Card>

          {/* Statut courant */}
          <Card title="Chronologie">
            <div className="text-sm font-semibold mb-3">
              {STATUS_LABEL[ticket.status] ?? ticket.status}
            </div>

            <ul className="space-y-2 text-xs">
              <TimelineRow label="Reçu" at={ticket.created_at} />
              <TimelineRow
                label="Pris en charge"
                at={ticket.acknowledged_at}
                by={
                  ticket.acknowledged_by
                    ? usersInfo[ticket.acknowledged_by]?.name ??
                      usersInfo[ticket.acknowledged_by]?.email ??
                      null
                    : null
                }
              />
              <TimelineRow
                label="En route"
                at={ticket.on_route_at}
                by={
                  ticket.on_route_by
                    ? usersInfo[ticket.on_route_by]?.name ??
                      usersInfo[ticket.on_route_by]?.email ??
                      null
                    : null
                }
              />
              <TimelineRow
                label="Sur place"
                at={ticket.on_site_at}
                by={
                  ticket.on_site_by
                    ? usersInfo[ticket.on_site_by]?.name ??
                      usersInfo[ticket.on_site_by]?.email ??
                      null
                    : null
                }
              />
              <TimelineRow
                label="Clôturé"
                at={ticket.completed_at}
                by={
                  ticket.completed_by
                    ? usersInfo[ticket.completed_by]?.name ??
                      usersInfo[ticket.completed_by]?.email ??
                      null
                    : null
                }
              />
            </ul>

            {(ticket.acknowledged_at && (ticket.on_site_at || ticket.completed_at)) && (
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t">
                <DurationCell
                  label="Mobilisation"
                  fromIso={ticket.acknowledged_at}
                  toIso={ticket.on_site_at}
                />
                <DurationCell
                  label="Sur place"
                  fromIso={ticket.on_site_at}
                  toIso={ticket.completed_at}
                />
                <DurationCell
                  label="Total"
                  fromIso={ticket.acknowledged_at}
                  toIso={ticket.completed_at}
                />
              </div>
            )}

            {ticket.assigned_to && (
              <div className="text-xs text-muted mt-3 pt-3 border-t">
                Assigné à :{' '}
                <strong>
                  {usersInfo[ticket.assigned_to]?.name ??
                    usersInfo[ticket.assigned_to]?.email ??
                    'inconnu'}
                </strong>
              </div>
            )}

            {ticket.report_sent_at && (
              <div className="text-xs text-muted mt-3 pt-3 border-t">
                <span className="text-green-700 dark:text-green-400 font-semibold">
                  ✓ Compte-rendu envoyé
                </span>
                <br />
                {formatDateLong(ticket.report_sent_at)}
                {Array.isArray(ticket.report_sent_to) && ticket.report_sent_to.length > 0 && (
                  <>
                    <br />
                    <span className="text-[11px]">
                      {ticket.report_sent_to.join(', ')}
                    </span>
                  </>
                )}
                <div className="mt-1">
                  <a
                    href={`/api/pdf/astreinte-report/${ticket.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-[11px] font-semibold"
                  >
                    Voir le PDF ↗
                  </a>
                </div>
              </div>
            )}

            {ticket.intervention_outcome && (
              <div className="text-xs mt-3 pt-3 border-t">
                <div className="font-semibold mb-1">Issue de l’intervention</div>
                <div className="text-muted">
                  {OUTCOME_LABEL_FR[ticket.intervention_outcome] ?? ticket.intervention_outcome}
                  {ticket.intervention_destination && (
                    <>
                      {' · '}
                      {DESTINATION_LABEL_FR[ticket.intervention_destination] ??
                        ticket.intervention_destination}
                    </>
                  )}
                </div>
                {ticket.intervention_comments && (
                  <div className="mt-2 p-2 bg-muted/30 rounded text-[11px] whitespace-pre-line">
                    {ticket.intervention_comments}
                  </div>
                )}
              </div>
            )}

            {ticket.optimus_animal_id && (
              <div className="text-xs mt-3 pt-3 border-t">
                <div className="font-semibold text-green-700 dark:text-green-400">
                  ✓ Animal créé en fourrière
                </div>
                <a
                  href={`/animals/${ticket.optimus_animal_id}`}
                  className="text-primary hover:underline text-[12px] font-semibold mt-1 inline-block"
                >
                  Voir la fiche animal ↗
                </a>
              </div>
            )}

            {ticket.optimus_invoice_id && (
              <div className="text-xs mt-3 pt-3 border-t">
                <div className="font-semibold text-green-700 dark:text-green-400">
                  ✓ Facture nuit générée
                </div>
                <a
                  href={`/documents/${ticket.optimus_invoice_id}`}
                  className="text-primary hover:underline text-[12px] font-semibold mt-1 inline-block"
                >
                  Voir la facture ↗
                </a>
              </div>
            )}
          </Card>

          {/* Timeline (tous events, y compris notes internes) */}
          <Card title="Activité complète">
            <ul className="space-y-3">
              {(events ?? []).map((e) => (
                <li
                  key={e.id}
                  className={`text-xs border-l-2 pl-3 py-0.5 ${
                    e.visible_to_declarant
                      ? 'border-slate-200 dark:border-slate-700'
                      : 'border-amber-400 dark:border-amber-600'
                  }`}
                >
                  <div className="flex items-center gap-2 text-muted">
                    {formatDateShort(e.created_at)}
                    {!e.visible_to_declarant && (
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase">
                        Interne
                      </span>
                    )}
                  </div>
                  <div className="font-medium mt-0.5">
                    {formatEventMessage(
                      e.event_type,
                      e.message,
                      e.metadata as { from?: string; to?: string } | null,
                      e.performed_by && usersInfo[e.performed_by]
                        ? usersInfo[e.performed_by].name ?? usersInfo[e.performed_by].email
                        : null
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Card({
  title,
  accent,
  children,
}: {
  title: string | React.ReactNode
  accent?: 'purple' | 'red'
  children: React.ReactNode
}) {
  const accentBorder =
    accent === 'purple'
      ? 'border-l-4 border-l-purple-500'
      : accent === 'red'
        ? 'border-l-4 border-l-red-500'
        : ''
  return (
    <div className={`bg-card border rounded-lg p-5 ${accentBorder}`}>
      <h3 className="text-[10px] uppercase tracking-[0.15em] font-bold text-muted mb-3">
        {title}
      </h3>
      {children}
    </div>
  )
}

function KV({ k, v, alert }: { k: string; v: string; alert?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">
        {k}
      </div>
      <div
        className={`text-sm font-medium mt-0.5 ${
          alert ? 'text-red-700 dark:text-red-400 font-bold' : ''
        }`}
      >
        {v}
      </div>
    </div>
  )
}

const dateLongFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const dateShortFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
function formatDateLong(iso: string) {
  return dateLongFormatter.format(new Date(iso))
}
function formatDateShort(iso: string) {
  return dateShortFormatter.format(new Date(iso))
}

function TimelineRow({
  label,
  at,
  by,
}: {
  label: string
  at: string | null
  by?: string | null
}) {
  if (!at) {
    return (
      <li className="flex items-baseline gap-2 text-muted/60 italic">
        <span className="font-semibold w-24 shrink-0">{label}</span>
        <span>—</span>
      </li>
    )
  }
  return (
    <li className="flex items-baseline gap-2">
      <span className="font-semibold w-24 shrink-0">{label}</span>
      <span className="flex-1">
        <span>{formatDateLong(at)}</span>
        {by && <span className="text-muted"> — {by}</span>}
      </span>
    </li>
  )
}

function formatDuration(fromIso: string | null, toIso: string | null): string {
  if (!fromIso || !toIso) return '—'
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime()
  if (ms < 0) return '—'
  const totalMin = Math.round(ms / 60000)
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m === 0 ? `${h} h` : `${h} h ${m.toString().padStart(2, '0')}`
}

function DurationCell({
  label,
  fromIso,
  toIso,
}: {
  label: string
  fromIso: string | null
  toIso: string | null
}) {
  return (
    <div className="text-center">
      <div className="text-[9px] uppercase tracking-wider font-bold text-muted">
        {label}
      </div>
      <div className="text-sm font-bold mt-0.5">{formatDuration(fromIso, toIso)}</div>
    </div>
  )
}
