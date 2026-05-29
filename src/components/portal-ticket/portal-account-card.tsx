import {
  IdCard,
  Mail,
  Phone,
  MapPin,
  UserCheck,
  UserX,
  Hash,
  Clock,
} from 'lucide-react'
import { getPortalProfileWithEmail } from '@/lib/actions/portal-profiles'

interface PortalAccountCardProps {
  userId: string | null
  ticketNumber: string
  createdAt: string
  statusLabel: string
  statusClassName: string
}

/**
 * Carte "Informations compte" affichée en haut des pages détail admin.
 * - Si user_id est non null : récupère le profil portail (nom, email,
 *   téléphone, adresse) via supabaseAdmin et affiche un badge "Compte portail".
 * - Si user_id est null : affiche un badge "Soumission directe" (demandes
 *   legacy hypothétiques d'avant l'ouverture du portail).
 */
export async function PortalAccountCard({
  userId,
  ticketNumber,
  createdAt,
  statusLabel,
  statusClassName,
}: PortalAccountCardProps) {
  const profile = userId ? await getPortalProfileWithEmail(userId) : null

  const fullName =
    profile && (profile.first_name || profile.last_name)
      ? `${profile.first_name} ${profile.last_name}`.trim()
      : null

  const address = profile
    ? [
        profile.address,
        [profile.postal_code, profile.city].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join('\n')
    : null

  return (
    <div className="bg-card rounded-xl border border-border p-5 mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <IdCard className="w-4 h-4 text-primary" /> Informations compte
        </h2>
        {userId ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <UserCheck className="w-3.5 h-3.5" />
            Compte portail
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-600 dark:text-slate-300">
            <UserX className="w-3.5 h-3.5" />
            Soumission directe
          </span>
        )}
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <dt className="text-xs text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
            <Hash className="w-3 h-3" /> Ticket
          </dt>
          <dd className="font-mono font-bold text-base">{ticketNumber}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Créé le
          </dt>
          <dd>
            {new Date(createdAt).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted uppercase tracking-wider mb-1">
            Statut actuel
          </dt>
          <dd>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusClassName}`}
            >
              {statusLabel}
            </span>
          </dd>
        </div>
      </dl>

      {userId && profile && (
        <div className="mt-5 pt-4 border-t border-border">
          <h3 className="text-xs text-muted uppercase tracking-wider mb-3 font-medium">
            Profil portail
          </h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {fullName && (
              <div>
                <dt className="text-xs text-muted mb-0.5">Nom complet</dt>
                <dd className="font-medium">{fullName}</dd>
              </div>
            )}
            {profile.email && (
              <div>
                <dt className="text-xs text-muted mb-0.5">Email du compte</dt>
                <dd>
                  <a
                    href={`mailto:${profile.email}`}
                    className="text-primary hover:underline break-all inline-flex items-center gap-1"
                  >
                    <Mail className="w-3.5 h-3.5" /> {profile.email}
                  </a>
                </dd>
              </div>
            )}
            {profile.phone && (
              <div>
                <dt className="text-xs text-muted mb-0.5">Téléphone</dt>
                <dd>
                  <a
                    href={`tel:${profile.phone}`}
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5" /> {profile.phone}
                  </a>
                </dd>
              </div>
            )}
            {address && (
              <div>
                <dt className="text-xs text-muted mb-0.5">Adresse</dt>
                <dd className="inline-flex items-start gap-1 whitespace-pre-line">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted" />
                  <span>{address}</span>
                </dd>
              </div>
            )}
          </dl>
          {!profile.first_name && !profile.last_name && !profile.phone && (
            <p className="text-xs italic text-muted mt-2">
              Le compte existe mais le profil portail n’a pas encore été
              complété par l’utilisateur.
            </p>
          )}
        </div>
      )}

      {userId && !profile && (
        <p className="text-xs italic text-muted mt-4">
          Compte portail introuvable (peut-être supprimé).
        </p>
      )}

      {!userId && (
        <p className="text-xs text-muted mt-4">
          Cette demande a été soumise sans compte utilisateur. Les
          fonctionnalités de messagerie portail ne sont pas disponibles.
        </p>
      )}
    </div>
  )
}
