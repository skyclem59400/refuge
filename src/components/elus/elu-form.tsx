'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertElu, type Elu, type ToneVariant, type CollectivityType } from '@/lib/actions/elus'

interface Props {
  initial?: Partial<Elu>
  mode: 'create' | 'edit'
}

const TONE_OPTIONS: { value: ToneVariant; label: string; example: string }[] = [
  { value: 'tu-prenom', label: 'tu + prénom', example: 'Bonjour Marjorie,' },
  { value: 'vous-prenom', label: 'vous + prénom', example: 'Bonjour Émeric,' },
  { value: 'vous-nom', label: 'vous + nom', example: 'Monsieur Siméon,' },
  { value: 'institutionnel', label: 'institutionnel', example: 'Madame, Monsieur,' },
]

const COLLECTIVITY_TYPES: { value: CollectivityType; label: string }[] = [
  { value: 'commune', label: 'Commune' },
  { value: 'epci', label: 'EPCI (CC, CA, métropole)' },
  { value: 'departement', label: 'Département' },
  { value: 'region', label: 'Région' },
  { value: 'etat', label: 'État (député, ministère…)' },
  { value: 'autre', label: 'Autre' },
]

export function EluForm({ initial, mode }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    civility: initial?.civility ?? 'Monsieur',
    first_name: initial?.first_name ?? '',
    last_name: initial?.last_name ?? '',
    role: initial?.role ?? '',
    collectivity_name: initial?.collectivity_name ?? '',
    collectivity_type: initial?.collectivity_type ?? 'commune' as CollectivityType,
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    postal_address: initial?.postal_address ?? '',
    tone_variant: initial?.tone_variant ?? 'vous-nom' as ToneVariant,
    engaged: initial?.engaged ?? false,
    notes: initial?.notes ?? '',
    tagsInput: initial?.tags?.join(', ') ?? '',
  })

  function update<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.first_name.trim() || !form.last_name.trim() || !form.role.trim()) {
      setError('Prénom, nom et rôle sont requis.')
      return
    }
    const tags = form.tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
    startTransition(async () => {
      const res = await upsertElu({
        id: initial?.id,
        civility: form.civility as 'Monsieur' | 'Madame',
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        role: form.role.trim(),
        collectivity_name: form.collectivity_name.trim() || null,
        collectivity_type: form.collectivity_type,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        postal_address: form.postal_address.trim() || null,
        tone_variant: form.tone_variant,
        engaged: form.engaged,
        notes: form.notes.trim() || null,
        tags,
      })
      if (res.error) setError(res.error)
      else router.push('/astreinte/elus')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      {error && (
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-sm">{error}</div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Field label="Civilité">
          <select value={form.civility ?? ''} onChange={(e) => update('civility', e.target.value as 'Monsieur' | 'Madame')} className={inputCls}>
            <option value="Monsieur">Monsieur</option>
            <option value="Madame">Madame</option>
          </select>
        </Field>
        <Field label="Prénom *">
          <input value={form.first_name} onChange={(e) => update('first_name', e.target.value)} className={inputCls} required />
        </Field>
        <Field label="Nom *">
          <input value={form.last_name} onChange={(e) => update('last_name', e.target.value)} className={inputCls} required />
        </Field>
      </div>

      <Field label="Rôle / fonction *">
        <input value={form.role} onChange={(e) => update('role', e.target.value)} placeholder="ex: Maire, Président CA, DGS, Député…" className={inputCls} required />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Field label="Collectivité">
            <input value={form.collectivity_name} onChange={(e) => update('collectivity_name', e.target.value)} placeholder="ex: Ville de Cambrai, CA2C" className={inputCls} />
          </Field>
        </div>
        <Field label="Type">
          <select value={form.collectivity_type} onChange={(e) => update('collectivity_type', e.target.value as CollectivityType)} className={inputCls}>
            {COLLECTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Téléphone">
          <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} className={inputCls} />
        </Field>
      </div>

      <Field label="Adresse postale">
        <input value={form.postal_address} onChange={(e) => update('postal_address', e.target.value)} className={inputCls} />
      </Field>

      <Field label="Ton de communication *">
        <select value={form.tone_variant} onChange={(e) => update('tone_variant', e.target.value as ToneVariant)} className={inputCls}>
          {TONE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label} — {t.example}</option>
          ))}
        </select>
      </Field>

      <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
        <input type="checkbox" checked={form.engaged} onChange={(e) => update('engaged', e.target.checked)} className="rounded" />
        Engagé sur la cause animale (passage à 1,25 €, soutien, mobilisation…)
      </label>

      <Field label="Tags (séparés par virgule)">
        <input value={form.tagsInput} onChange={(e) => update('tagsInput', e.target.value)} placeholder="VIP, CAC, À vérifier email" className={inputCls} />
      </Field>

      <Field label="Notes libres">
        <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={4} className={inputCls} placeholder="Parcours, dossiers en cours, historique des échanges…" />
      </Field>

      <div className="flex items-center gap-3 pt-3 border-t border-border">
        <button type="submit" disabled={isPending} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
          {isPending ? 'Enregistrement…' : (mode === 'create' ? 'Créer l\'élu' : 'Enregistrer')}
        </button>
        <button type="button" onClick={() => router.push('/astreinte/elus')} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-surface-hover">
          Annuler
        </button>
      </div>
    </form>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-lg bg-surface-dark border border-border text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted mb-1">{label}</label>
      {children}
    </div>
  )
}
