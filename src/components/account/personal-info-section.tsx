'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Loader2,
  Pencil,
  X,
  Save,
  User as UserIcon,
  Mail,
  Phone,
  Calendar,
  MapPin,
  ShieldCheck,
} from 'lucide-react'
import { AddressAutocomplete, type BanSelection } from '@/components/ui/address-autocomplete'
import { completeMyProfile } from '@/lib/actions/user-profile'
import type { UserProfile } from '@/lib/types/database'

interface Props {
  readonly profile: UserProfile | null
  readonly currentAuthEmail: string
}

function formatBirthDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function PersonalInfoSection({ profile, currentAuthEmail }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [lastName, setLastName] = useState(profile?.last_name || '')
  const [firstName, setFirstName] = useState(profile?.first_name || '')
  const [personalEmail, setPersonalEmail] = useState(profile?.personal_email || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [birthDate, setBirthDate] = useState(profile?.birth_date || '')

  const initialBan: BanSelection | null = profile?.address_label
    ? {
        label: profile.address_label,
        postcode: profile.address_postcode,
        city: profile.address_city,
        lat: profile.address_lat,
        lng: profile.address_lng,
        banId: profile.address_ban_id,
      }
    : null
  const [address, setAddress] = useState<BanSelection | null>(initialBan)

  function resetForm() {
    setLastName(profile?.last_name || '')
    setFirstName(profile?.first_name || '')
    setPersonalEmail(profile?.personal_email || '')
    setPhone(profile?.phone || '')
    setBirthDate(profile?.birth_date || '')
    setAddress(initialBan)
  }

  function handleCancel() {
    resetForm()
    setEditing(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!address || !address.banId) {
      toast.error('Selectionne une adresse valide dans la liste de suggestions')
      return
    }
    startTransition(async () => {
      const res = await completeMyProfile({
        last_name: lastName,
        first_name: firstName,
        personal_email: personalEmail,
        phone,
        birth_date: birthDate || null,
        address_label: address.label,
        address_postcode: address.postcode || '',
        address_city: address.city || '',
        address_lat: address.lat,
        address_lng: address.lng,
        address_ban_id: address.banId,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(res.emailChanged ? 'Profil mis a jour. Un email de confirmation a ete envoye.' : 'Profil mis a jour')
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <section className="bg-surface rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Mes informations personnelles
          </h2>
          <p className="text-xs text-muted mt-1">
            Ces donnees sont obligatoires (assurance, RGPD, gestion conges et astreintes).
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-primary border border-primary/30 hover:bg-primary/10"
          >
            <Pencil className="w-3.5 h-3.5" /> Modifier
          </button>
        )}
      </div>

      {!editing ? (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <Field icon={<UserIcon className="w-3.5 h-3.5" />} label="Nom" value={profile?.last_name || '—'} />
          <Field icon={<UserIcon className="w-3.5 h-3.5" />} label="Prenom" value={profile?.first_name || '—'} />
          <Field
            icon={<Mail className="w-3.5 h-3.5" />}
            label="Email personnel"
            value={profile?.personal_email || '—'}
          />
          <Field icon={<Phone className="w-3.5 h-3.5" />} label="Telephone" value={profile?.phone || '—'} />
          <Field
            icon={<Calendar className="w-3.5 h-3.5" />}
            label="Date de naissance"
            value={formatBirthDate(profile?.birth_date ?? null)}
          />
          <Field
            icon={<MapPin className="w-3.5 h-3.5" />}
            label="Adresse"
            value={profile?.address_label || '—'}
          />
          {currentAuthEmail && (
            <Field
              icon={<Mail className="w-3.5 h-3.5" />}
              label="Email de connexion"
              value={currentAuthEmail}
              subtle
            />
          )}
        </dl>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="pi_last_name" className="block text-xs font-medium text-muted mb-1">
                Nom <span className="text-error">*</span>
              </label>
              <input
                id="pi_last_name"
                type="text"
                required
                minLength={2}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="pi_first_name" className="block text-xs font-medium text-muted mb-1">
                Prenom <span className="text-error">*</span>
              </label>
              <input
                id="pi_first_name"
                type="text"
                required
                minLength={2}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="pi_email" className="block text-xs font-medium text-muted mb-1">
                Email personnel <span className="text-error">*</span>
              </label>
              <input
                id="pi_email"
                type="email"
                required
                value={personalEmail}
                onChange={(e) => setPersonalEmail(e.target.value)}
                className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="pi_phone" className="block text-xs font-medium text-muted mb-1">
                Telephone <span className="text-error">*</span>
              </label>
              <input
                id="pi_phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="pi_birth_date" className="block text-xs font-medium text-muted mb-1">
                Date de naissance
              </label>
              <input
                id="pi_birth_date"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Adresse personnelle <span className="text-error">*</span>
            </label>
            <AddressAutocomplete
              value={address}
              onChange={setAddress}
              placeholder="N° et nom de rue, ville…"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-border">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted hover:text-text border border-border hover:bg-surface-hover"
            >
              <X className="w-4 h-4" /> Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white gradient-primary hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

function Field({
  icon,
  label,
  value,
  subtle,
}: {
  readonly icon: React.ReactNode
  readonly label: string
  readonly value: string
  readonly subtle?: boolean
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted flex items-center gap-1.5 mb-1">
        {icon}
        {label}
      </dt>
      <dd className={`text-sm ${subtle ? 'text-muted' : 'text-text'}`}>{value}</dd>
    </div>
  )
}
