'use client'

import { useActionState, useState } from 'react'
import {
  Globe,
  Mail,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Power,
  X,
} from 'lucide-react'
import {
  addAuthorizedDomain,
  addAuthorizedEmail,
  toggleDomainActive,
  toggleEmailActive,
  deleteDomain,
  deleteEmail,
  type ActionState,
} from '@/app/(app)/astreinte/acces/actions'

interface Domain {
  domain: string
  scope_type: string
  organization_label: string | null
  municipality_code_insee: string | null
  epci_code_siren: string | null
  active: boolean
  notes: string | null
  created_at: string
  validated_at: string
}

interface Email {
  email: string
  scope_type: string
  full_name: string | null
  role: string | null
  organization_label: string | null
  municipality_code_insee: string | null
  active: boolean
  notes: string | null
  created_at: string
  validated_at: string
}

interface Commune {
  code_insee: string
  name: string
  postal_codes: string[]
  epci_code_siren: string | null
}

const SCOPE_LABELS: Record<string, string> = {
  municipality: 'Commune',
  epci: 'EPCI',
  national_force: 'Force nationale',
  organization: 'Organisation',
  veterinary: 'Vétérinaire',
  other: 'Autre',
}

export function AccessControlPanel({
  domains,
  emails,
  communes,
}: {
  domains: Domain[]
  emails: Email[]
  communes: Commune[]
}) {
  const [tab, setTab] = useState<'domains' | 'emails'>('domains')
  const [showAddDomain, setShowAddDomain] = useState(false)
  const [showAddEmail, setShowAddEmail] = useState(false)

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        <TabButton active={tab === 'domains'} onClick={() => setTab('domains')}>
          <Globe size={14} />
          Domaines autorisés
          <span className="ml-1 text-xs opacity-60">({domains.filter((d) => d.active).length})</span>
        </TabButton>
        <TabButton active={tab === 'emails'} onClick={() => setTab('emails')}>
          <Mail size={14} />
          Emails individuels
          <span className="ml-1 text-xs opacity-60">({emails.filter((e) => e.active).length})</span>
        </TabButton>
      </div>

      {tab === 'domains' && (
        <DomainsTab
          domains={domains}
          showAdd={showAddDomain}
          onShowAdd={setShowAddDomain}
        />
      )}
      {tab === 'emails' && (
        <EmailsTab
          emails={emails}
          communes={communes}
          showAdd={showAddEmail}
          onShowAdd={setShowAddEmail}
        />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

// ============================================================================

function DomainsTab({
  domains,
  showAdd,
  onShowAdd,
}: {
  domains: Domain[]
  showAdd: boolean
  onShowAdd: (v: boolean) => void
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addAuthorizedDomain,
    { status: 'idle' }
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">
          Tout email avec un domaine listé pourra accéder au portail. Idéal pour les{' '}
          gendarmeries, préfectures, mairies avec adresse pro.
        </p>
        {!showAdd && (
          <button
            onClick={() => onShowAdd(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-slate-50 dark:hover:bg-slate-900/50"
          >
            <Plus size={14} />
            Ajouter un domaine
          </button>
        )}
      </div>

      {showAdd && (
        <div className="bg-card border rounded-lg p-4 mb-4 relative">
          <button
            onClick={() => onShowAdd(false)}
            className="absolute top-3 right-3 text-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
          <h3 className="text-sm font-semibold mb-3">Nouveau domaine autorisé</h3>
          <form
            action={(fd) => {
              action(fd)
              if (state.status !== 'error') onShowAdd(false)
            }}
            className="grid md:grid-cols-2 gap-3"
          >
            <Field label="Domaine *">
              <input
                name="domain"
                required
                placeholder="cambrai.fr"
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              />
            </Field>
            <Field label="Type *">
              <select
                name="scope_type"
                required
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              >
                <option value="municipality">Commune</option>
                <option value="national_force">Force nationale</option>
                <option value="epci">EPCI</option>
                <option value="organization">Organisation</option>
                <option value="veterinary">Vétérinaire</option>
              </select>
            </Field>
            <Field label="Libellé organisation">
              <input
                name="organization_label"
                placeholder="ex: Mairie de Cambrai"
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              />
            </Field>
            <Field label="Notes">
              <input
                name="notes"
                placeholder="optionnel"
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              />
            </Field>
            <div className="md:col-span-2 flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={pending}
                className="px-4 py-2 rounded-md font-semibold text-white text-sm gradient-primary hover:opacity-90 disabled:opacity-50"
              >
                {pending ? 'Ajout…' : 'Ajouter'}
              </button>
              {state.status === 'error' && (
                <span className="inline-flex items-center gap-1 text-sm text-red-700">
                  <AlertCircle size={14} />
                  {state.message}
                </span>
              )}
              {state.status === 'success' && (
                <span className="inline-flex items-center gap-1 text-sm text-green-700">
                  <CheckCircle2 size={14} />
                  {state.message}
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Domaine</th>
              <th className="px-4 py-3 text-left font-semibold">Type</th>
              <th className="px-4 py-3 text-left font-semibold">Organisation</th>
              <th className="px-4 py-3 text-left font-semibold">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {domains.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted">
                  Aucun domaine autorisé pour l’instant.
                </td>
              </tr>
            ) : (
              domains.map((d) => (
                <tr key={d.domain} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">{d.domain}</td>
                  <td className="px-4 py-3 text-xs">{SCOPE_LABELS[d.scope_type]}</td>
                  <td className="px-4 py-3 text-xs">{d.organization_label ?? '—'}</td>
                  <td className="px-4 py-3">
                    {d.active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800 border border-green-200">
                        <CheckCircle2 size={11} />
                        Actif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200">
                        Désactivé
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={async () => {
                          await toggleDomainActive(d.domain, !d.active)
                        }}
                        className="text-xs text-muted hover:text-foreground"
                        title={d.active ? 'Désactiver' : 'Réactiver'}
                      >
                        <Power size={14} />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Supprimer ${d.domain} de la whitelist ?`)) {
                            await deleteDomain(d.domain)
                          }
                        }}
                        className="text-xs text-red-600 hover:text-red-800"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================================

function EmailsTab({
  emails,
  communes,
  showAdd,
  onShowAdd,
}: {
  emails: Email[]
  communes: Commune[]
  showAdd: boolean
  onShowAdd: (v: boolean) => void
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addAuthorizedEmail,
    { status: 'idle' }
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">
          Cas particuliers : maire avec email perso, vétérinaire partenaire, exception ponctuelle.
          L’email exact (et lui seul) pourra accéder au portail.
        </p>
        {!showAdd && (
          <button
            onClick={() => onShowAdd(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-slate-50 dark:hover:bg-slate-900/50"
          >
            <Plus size={14} />
            Ajouter un email
          </button>
        )}
      </div>

      {showAdd && (
        <div className="bg-card border rounded-lg p-4 mb-4 relative">
          <button
            onClick={() => onShowAdd(false)}
            className="absolute top-3 right-3 text-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
          <h3 className="text-sm font-semibold mb-3">Nouvel email autorisé</h3>
          <form
            action={(fd) => {
              action(fd)
              if (state.status !== 'error') onShowAdd(false)
            }}
            className="grid md:grid-cols-2 gap-3"
          >
            <Field label="Email *">
              <input
                name="email"
                type="email"
                required
                placeholder="prenom.nom@orange.fr"
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              />
            </Field>
            <Field label="Type *">
              <select
                name="scope_type"
                required
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              >
                <option value="municipality">Commune</option>
                <option value="veterinary">Vétérinaire</option>
                <option value="other">Autre</option>
              </select>
            </Field>
            <Field label="Nom et prénom">
              <input
                name="full_name"
                placeholder="ex: Jean Dupont"
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              />
            </Field>
            <Field label="Fonction">
              <input
                name="role"
                placeholder="ex: maire, OPJ, véto"
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              />
            </Field>
            <Field label="Commune (si commune)">
              <select
                name="municipality_code_insee"
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              >
                <option value="">— Aucune —</option>
                {communes.map((c) => (
                  <option key={c.code_insee} value={c.code_insee}>
                    {c.name} ({c.postal_codes[0]})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Organisation">
              <input
                name="organization_label"
                placeholder="ex: Clinique Saint-Roch"
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Notes">
                <input
                  name="notes"
                  placeholder="optionnel — contexte, raison de l'autorisation"
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                />
              </Field>
            </div>
            <div className="md:col-span-2 flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={pending}
                className="px-4 py-2 rounded-md font-semibold text-white text-sm gradient-primary hover:opacity-90 disabled:opacity-50"
              >
                {pending ? 'Ajout…' : 'Ajouter'}
              </button>
              {state.status === 'error' && (
                <span className="inline-flex items-center gap-1 text-sm text-red-700">
                  <AlertCircle size={14} />
                  {state.message}
                </span>
              )}
              {state.status === 'success' && (
                <span className="inline-flex items-center gap-1 text-sm text-green-700">
                  <CheckCircle2 size={14} />
                  {state.message}
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Email</th>
              <th className="px-4 py-3 text-left font-semibold">Personne</th>
              <th className="px-4 py-3 text-left font-semibold">Organisation</th>
              <th className="px-4 py-3 text-left font-semibold">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {emails.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted">
                  Aucun email individuellement autorisé.
                </td>
              </tr>
            ) : (
              emails.map((e) => (
                <tr key={e.email} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">{e.email}</td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium">{e.full_name ?? '—'}</div>
                    {e.role && <div className="text-muted">{e.role}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">{e.organization_label ?? '—'}</td>
                  <td className="px-4 py-3">
                    {e.active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800 border border-green-200">
                        <CheckCircle2 size={11} />
                        Actif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200">
                        Désactivé
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={async () => {
                          await toggleEmailActive(e.email, !e.active)
                        }}
                        className="text-xs text-muted hover:text-foreground"
                        title={e.active ? 'Désactiver' : 'Réactiver'}
                      >
                        <Power size={14} />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Supprimer ${e.email} de la whitelist ?`)) {
                            await deleteEmail(e.email)
                          }
                        }}
                        className="text-xs text-red-600 hover:text-red-800"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted mb-1.5">{label}</span>
      {children}
    </label>
  )
}
