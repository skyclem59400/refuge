import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { createClient } from '@/lib/supabase/server'
import { getInquiry, type ChatMessageRow } from '@/lib/actions/chat-inquiries'
import { ResolveActions } from '@/components/contacts-entrants/resolve-actions'
import { ArrowLeft, MessageSquare, Mail, Phone, MapPin, User, Tag, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

const INTENT_LABEL: Record<string, string> = {
  adoption_general: 'Adoption (générale)',
  adoption_specific: 'Adoption ciblée',
  famille_accueil: "Famille d'accueil",
  benevolat: 'Bénévolat',
  signalement: 'Signalement',
  info: 'Information',
}

const STATUS_LABEL: Record<string, string> = {
  active: 'En cours',
  qualified: 'Qualifié',
  abandoned: 'Abandonné',
  resolved: 'Résolu',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function InquiryDetailPage({ params }: PageProps) {
  const { id } = await params
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')
  if (!ctx.permissions.isOwner) {
    return (
      <div className="animate-fade-up p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Accès restreint</h1>
        <p className="text-sm text-muted">Cette section est réservée à l&apos;administrateur.</p>
      </div>
    )
  }

  const { inquiry, messages } = await getInquiry(id)
  if (!inquiry) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const resolverEmail = user?.email || 'Admin'

  const fullName = [inquiry.contact_first_name, inquiry.contact_last_name].filter(Boolean).join(' ')
  const userMessages = messages.filter((m) => m.role === 'user' || m.role === 'assistant')

  return (
    <div className="animate-fade-up max-w-6xl">
      <Link
        href="/contacts-entrants"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la liste
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">
              {INTENT_LABEL[inquiry.intent] || inquiry.intent}
              {inquiry.animal_name && (
                <span className="text-muted font-normal"> — {inquiry.animal_name}</span>
              )}
            </h1>
          </div>
          <p className="text-sm text-muted">
            Démarré le {new Date(inquiry.started_at).toLocaleDateString('fr-FR', {
              day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            inquiry.status === 'qualified' ? 'bg-amber-500/15 text-amber-700' :
            inquiry.status === 'resolved' ? 'bg-emerald-500/15 text-emerald-700' :
            inquiry.status === 'active' ? 'bg-blue-500/15 text-blue-600' :
            'bg-slate-500/15 text-slate-500'
          }`}>
            {STATUS_LABEL[inquiry.status] || inquiry.status}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Conversation */}
        <div className="lg:col-span-2">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted-bg/50">
              <h2 className="font-semibold text-sm">Conversation</h2>
            </div>
            <div className="p-5 space-y-4 max-h-[600px] overflow-y-auto">
              {userMessages.length === 0 ? (
                <p className="text-sm text-muted italic">Aucun message.</p>
              ) : (
                userMessages.map((m) => <Bubble key={m.id} msg={m} />)
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Contact */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-muted" /> Contact
            </h2>
            <dl className="space-y-2.5 text-sm">
              {fullName && (
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wider">Nom</dt>
                  <dd className="font-medium">{fullName}</dd>
                </div>
              )}
              {inquiry.contact_email && (
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                  <a href={`mailto:${inquiry.contact_email}`} className="text-primary hover:underline break-all">
                    {inquiry.contact_email}
                  </a>
                </div>
              )}
              {inquiry.contact_phone && (
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                  <a href={`tel:${inquiry.contact_phone}`} className="text-primary hover:underline">
                    {inquiry.contact_phone}
                  </a>
                </div>
              )}
              {(inquiry.contact_city || inquiry.contact_postal_code) && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                  <span>
                    {[inquiry.contact_postal_code, inquiry.contact_city].filter(Boolean).join(' ')}
                  </span>
                </div>
              )}
              {!inquiry.contact_email && !inquiry.contact_phone && (
                <p className="text-xs text-muted italic">Pas encore de coordonnées.</p>
              )}
            </dl>
          </div>

          {/* Tags */}
          {inquiry.tags && inquiry.tags.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4 text-muted" /> Tags
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {inquiry.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-mono"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Résumé */}
          {inquiry.summary && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="font-semibold text-sm mb-3">Résumé IA</h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{inquiry.summary}</p>
            </div>
          )}

          {/* Profile data */}
          {inquiry.profile_data && Object.keys(inquiry.profile_data).length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="font-semibold text-sm mb-3">Profil capté</h2>
              <ProfileDisplay profile={inquiry.profile_data} />
            </div>
          )}

          {/* Source / Activity */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted" /> Activité
            </h2>
            <dl className="space-y-2.5 text-sm">
              {inquiry.source_page && (
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wider">Source</dt>
                  <dd className="font-mono text-xs">{inquiry.source_page}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted uppercase tracking-wider">Messages</dt>
                <dd>{inquiry.message_count}</dd>
              </div>
              {inquiry.qualified_at && (
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wider">Qualifié le</dt>
                  <dd>{new Date(inquiry.qualified_at).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}</dd>
                </div>
              )}
              {inquiry.resolved_at && (
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wider">Résolu le</dt>
                  <dd>{new Date(inquiry.resolved_at).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}</dd>
                  {inquiry.resolved_notes && (
                    <dd className="text-xs text-muted mt-1">{inquiry.resolved_notes}</dd>
                  )}
                </div>
              )}
            </dl>
          </div>

          {/* Actions */}
          {inquiry.status !== 'resolved' && (
            <ResolveActions inquiryId={inquiry.id} resolvedBy={resolverEmail} />
          )}
        </div>
      </div>
    </div>
  )
}

function Bubble({ msg }: { msg: ChatMessageRow }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-primary text-white rounded-br-md'
            : 'bg-muted-bg text-foreground rounded-bl-md'
        }`}
      >
        <div className={`text-[10px] uppercase tracking-wider mb-1 opacity-70 ${
          isUser ? 'text-white/70' : 'text-muted'
        }`}>
          {isUser ? 'Visiteur' : 'Assistant'} · {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>
        {msg.content}
      </div>
    </div>
  )
}

function ProfileDisplay({ profile }: { profile: Record<string, unknown> }) {
  const entries = Object.entries(profile).filter(([, v]) => v !== null && v !== undefined && v !== '')
  if (entries.length === 0) return <p className="text-xs text-muted italic">Vide</p>

  return (
    <dl className="space-y-2 text-xs">
      {entries.map(([k, v]) => (
        <div key={k}>
          <dt className="text-muted">{humanize(k)}</dt>
          <dd className="font-mono text-foreground/90">
            {typeof v === 'object' ? JSON.stringify(v, null, 0) : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function humanize(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
}
