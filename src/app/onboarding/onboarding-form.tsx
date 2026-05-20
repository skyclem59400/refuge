'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { Loader2, LogOut, Mail, Phone, User, Calendar, ShieldCheck } from 'lucide-react'
import { AddressAutocomplete, type BanSelection } from '@/components/ui/address-autocomplete'
import { completeMyProfile } from '@/lib/actions/user-profile'

interface InitialProfile {
  last_name: string
  first_name: string
  personal_email: string
  phone: string
  birth_date: string
  address_label: string
  address_postcode: string
  address_city: string
  address_lat: number | null
  address_lng: number | null
  address_ban_id: string | null
}

interface Props {
  readonly currentAuthEmail: string
  readonly isPseudoAccount: boolean
  readonly initialProfile: InitialProfile
}

export function OnboardingForm({ currentAuthEmail, isPseudoAccount, initialProfile }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [lastName, setLastName] = useState(initialProfile.last_name)
  const [firstName, setFirstName] = useState(initialProfile.first_name)
  const [personalEmail, setPersonalEmail] = useState(initialProfile.personal_email)
  const [phone, setPhone] = useState(initialProfile.phone)
  const [birthDate, setBirthDate] = useState(initialProfile.birth_date)

  const initialBan: BanSelection | null = initialProfile.address_label
    ? {
        label: initialProfile.address_label,
        postcode: initialProfile.address_postcode || null,
        city: initialProfile.address_city || null,
        lat: initialProfile.address_lat,
        lng: initialProfile.address_lng,
        banId: initialProfile.address_ban_id,
      }
    : null
  const [address, setAddress] = useState<BanSelection | null>(initialBan)

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

      if (res.emailChanged) {
        toast.success('Profil enregistre. Un email de confirmation a ete envoye a ' + personalEmail)
      } else {
        toast.success('Profil enregistre, bienvenue !')
      }
      router.push('/dashboard')
      router.refresh()
    })
  }

  async function handleSignOut() {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-surface-dark py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="Optimus" width={64} height={64} className="mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-text">Bienvenue sur Optimus</h1>
          <p className="text-muted text-sm mt-2 max-w-lg mx-auto">
            Pour acceder a la plateforme, complete ton profil. Ces informations sont obligatoires
            (assurance, RGPD, gestion des conges et des astreintes).
          </p>
        </div>

        {isPseudoAccount && (
          <div className="mb-6 p-4 rounded-lg bg-primary/10 border border-primary/30 text-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-text">Migration vers la connexion par email</p>
                <p className="text-muted">
                  Tu te connectes actuellement par pseudo. Apres validation, ton email personnel
                  deviendra ton identifiant officiel — tu recevras un mail de confirmation pour le
                  verifier. Le mode pseudo restera fonctionnel pendant 2 mois en parallele.
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl p-6 border border-border space-y-5">
          {/* Section : Identite */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
              <User className="w-3.5 h-3.5" /> Identite
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="last_name" className="block text-xs font-medium text-muted mb-1">
                  Nom <span className="text-error">*</span>
                </label>
                <input
                  id="last_name"
                  type="text"
                  required
                  minLength={2}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Dupont"
                  className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="first_name" className="block text-xs font-medium text-muted mb-1">
                  Prenom <span className="text-error">*</span>
                </label>
                <input
                  id="first_name"
                  type="text"
                  required
                  minLength={2}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Marie"
                  className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="birth_date" className="block text-xs font-medium text-muted mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Date de naissance
                </label>
                <input
                  id="birth_date"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Section : Contact */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" /> Contact
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="personal_email" className="block text-xs font-medium text-muted mb-1">
                  Email personnel <span className="text-error">*</span>
                </label>
                <input
                  id="personal_email"
                  type="email"
                  required
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  placeholder="prenom.nom@exemple.com"
                  className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                />
                {isPseudoAccount && (
                  <p className="text-[11px] text-muted mt-1">
                    Tu pourras te connecter avec cet email apres validation.
                  </p>
                )}
                {!isPseudoAccount && currentAuthEmail && (
                  <p className="text-[11px] text-muted mt-1">
                    Compte courant : {currentAuthEmail}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="phone" className="block text-xs font-medium text-muted mb-1 flex items-center gap-1.5">
                  <Phone className="w-3 h-3" /> Telephone <span className="text-error">*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="06 12 34 56 78"
                  className="w-full px-3 py-2 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Section : Adresse */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              Adresse personnelle <span className="text-error">*</span>
            </h2>
            <AddressAutocomplete
              value={address}
              onChange={setAddress}
              placeholder="N° et nom de rue, ville…"
            />
            <p className="text-[11px] text-muted mt-1">
              Tape ton adresse et selectionne une suggestion dans la liste pour la valider.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-border flex flex-col-reverse sm:flex-row gap-3 sm:justify-between">
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-muted hover:text-text border border-border hover:bg-surface-hover"
            >
              <LogOut className="w-4 h-4" /> Se deconnecter
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white gradient-primary hover:opacity-90 disabled:opacity-50 shadow-lg shadow-primary/25"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {isPending ? 'Enregistrement…' : 'Valider et acceder a la plateforme'}
            </button>
          </div>
        </form>

        <p className="text-center text-[11px] text-muted mt-4">
          Tes informations sont stockees dans Supabase (UE), confidentielles, et ne sont
          accessibles qu'aux administrateurs de ton etablissement.
        </p>
      </div>
    </div>
  )
}
