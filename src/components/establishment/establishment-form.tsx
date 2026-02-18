'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { updateEstablishment } from '@/lib/actions/establishments'
import { LogoUpload } from '@/components/establishment/logo-upload'
import type { Establishment } from '@/lib/types/database'

interface EstablishmentFormProps {
  establishment: Establishment
}

export function EstablishmentForm({ establishment }: EstablishmentFormProps) {
  const [name, setName] = useState(establishment.name)
  const [legalName, setLegalName] = useState(establishment.legal_name)
  const [description, setDescription] = useState(establishment.description)
  const [email, setEmail] = useState(establishment.email)
  const [phone, setPhone] = useState(establishment.phone)
  const [website, setWebsite] = useState(establishment.website)
  const [address, setAddress] = useState(establishment.address)
  const [iban, setIban] = useState(establishment.iban)
  const [bic, setBic] = useState(establishment.bic)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }

    startTransition(async () => {
      const result = await updateEstablishment({
        name: name.trim(),
        legal_name: legalName.trim(),
        description: description.trim(),
        email: email.trim(),
        phone: phone.trim(),
        website: website.trim(),
        address: address.trim(),
        iban: iban.trim(),
        bic: bic.trim(),
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Informations mises a jour')
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-6 space-y-5">
      <h2 className="text-lg font-bold">Informations de l&apos;etablissement</h2>

      <LogoUpload
        establishmentId={establishment.id}
        currentLogoUrl={establishment.logo_url}
        establishmentName={establishment.name}
      />

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Nom *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Raison sociale
          </label>
          <input
            type="text"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm resize-y
            focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Telephone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Site web
          </label>
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://..."
            className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors
              placeholder:text-muted/50"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Adresse
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            IBAN
          </label>
          <input
            type="text"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            placeholder="FR76 ..."
            className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm font-mono
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors
              placeholder:text-muted/50"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            BIC
          </label>
          <input
            type="text"
            value={bic}
            onChange={(e) => setBic(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm font-mono
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 rounded-lg font-semibold text-white text-sm
            bg-primary hover:bg-primary-dark transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            shadow-lg shadow-primary/25"
        >
          {isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
