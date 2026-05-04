'use client'

import { useActionState, useEffect } from 'react'
import { CheckCircle2, AlertCircle, Save } from 'lucide-react'
import { updateCommune, type UpdateCommuneState } from '@/app/(app)/astreinte/communes/actions'

interface Commune {
  code_insee: string
  name: string
  convention_status: 'active' | 'pending' | 'none' | 'terminated'
  convention_start_date: string | null
  convention_end_date: string | null
  convention_contact_name: string | null
  convention_contact_email: string | null
  convention_contact_phone: string | null
  convention_yearly_fee: number | null
  day_intervention_fee: number | null
  night_intervention_fee: number | null
  notes: string | null
}

const initialState: UpdateCommuneState = { status: 'idle' }

export function CommuneForm({ commune }: { commune: Commune }) {
  const [state, action, pending] = useActionState(updateCommune, initialState)

  // Auto-clear du statut success après 3s
  useEffect(() => {
    if (state.status === 'success') {
      const t = setTimeout(() => {
        // hack pour reset visuel — on laisse le state, c'est juste l'animation
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [state])

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="code_insee" value={commune.code_insee} />

      {/* Statut convention */}
      <Section title="Statut de la convention">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(['active', 'pending', 'none', 'terminated'] as const).map((s) => {
            const labels = {
              active: 'Active',
              pending: 'En cours',
              none: 'Aucune',
              terminated: 'Résiliée',
            }
            return (
              <label
                key={s}
                className="flex items-center gap-2 p-3 border rounded-md cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name="convention_status"
                  value={s}
                  defaultChecked={commune.convention_status === s}
                  className="accent-primary"
                />
                <span className="text-sm font-medium">{labels[s]}</span>
              </label>
            )
          })}
        </div>
      </Section>

      <Section title="Période de validité">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date de début">
            <input
              type="date"
              name="convention_start_date"
              defaultValue={commune.convention_start_date ?? ''}
              className="w-full px-3 py-2 border rounded-md text-sm bg-background"
            />
          </Field>
          <Field label="Date de fin">
            <input
              type="date"
              name="convention_end_date"
              defaultValue={commune.convention_end_date ?? ''}
              className="w-full px-3 py-2 border rounded-md text-sm bg-background"
            />
          </Field>
        </div>
      </Section>

      <Section title="Contact référent (mairie)">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Nom et fonction">
            <input
              type="text"
              name="convention_contact_name"
              defaultValue={commune.convention_contact_name ?? ''}
              placeholder="ex: Marie Dupont, secrétaire de mairie"
              className="w-full px-3 py-2 border rounded-md text-sm bg-background"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              name="convention_contact_email"
              defaultValue={commune.convention_contact_email ?? ''}
              placeholder="contact@mairie.fr"
              className="w-full px-3 py-2 border rounded-md text-sm bg-background"
            />
          </Field>
          <Field label="Téléphone">
            <input
              type="tel"
              name="convention_contact_phone"
              defaultValue={commune.convention_contact_phone ?? ''}
              placeholder="03 27 …"
              className="w-full px-3 py-2 border rounded-md text-sm bg-background"
            />
          </Field>
        </div>
      </Section>

      <Section title="Tarification (€)">
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Cotisation annuelle">
            <input
              type="number"
              step="0.01"
              name="convention_yearly_fee"
              defaultValue={commune.convention_yearly_fee ?? ''}
              placeholder="ex: 1500.00"
              className="w-full px-3 py-2 border rounded-md text-sm bg-background tabular-nums"
            />
          </Field>
          <Field label="Tarif intervention jour">
            <input
              type="number"
              step="0.01"
              name="day_intervention_fee"
              defaultValue={commune.day_intervention_fee ?? ''}
              placeholder="laisser vide = défaut SDA"
              className="w-full px-3 py-2 border rounded-md text-sm bg-background tabular-nums"
            />
          </Field>
          <Field label="Tarif intervention nuit">
            <input
              type="number"
              step="0.01"
              name="night_intervention_fee"
              defaultValue={commune.night_intervention_fee ?? ''}
              placeholder="laisser vide = défaut SDA"
              className="w-full px-3 py-2 border rounded-md text-sm bg-background tabular-nums"
            />
          </Field>
        </div>
      </Section>

      <Section title="Notes internes">
        <textarea
          name="notes"
          defaultValue={commune.notes ?? ''}
          rows={4}
          className="w-full px-3 py-2 border rounded-md text-sm bg-background resize-none"
          placeholder="Spécificités, historique, contacts secondaires…"
        />
      </Section>

      <div className="flex items-center gap-4 pt-4 border-t">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white text-sm gradient-primary hover:opacity-90 transition shadow-lg shadow-primary/25 disabled:opacity-50"
        >
          <Save size={16} />
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>

        {state.status === 'success' && (
          <span className="inline-flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
            <CheckCircle2 size={16} />
            Modifications enregistrées.
          </span>
        )}
        {state.status === 'error' && (
          <span className="inline-flex items-center gap-2 text-sm text-red-700">
            <AlertCircle size={16} />
            {state.message}
          </span>
        )}
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs uppercase tracking-wider font-semibold text-muted mb-3">
        {title}
      </h3>
      {children}
    </section>
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
