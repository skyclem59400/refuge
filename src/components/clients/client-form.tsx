'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClientAction, updateClientAction } from '@/lib/actions/clients'
import { getCategoryLabel, ALL_CONTACT_CATEGORIES } from '@/lib/sda-utils'
import type { Client, ContactCategory } from '@/lib/types/database'

interface ClientFormProps {
  client?: Client
}

export function ClientForm({ client }: ClientFormProps) {
  const [name, setName] = useState(client?.name || '')
  const [email, setEmail] = useState(client?.email || '')
  const [phone, setPhone] = useState(client?.phone || '')
  const [address, setAddress] = useState(client?.address || '')
  const [postalCode, setPostalCode] = useState(client?.postal_code || '')
  const [city, setCity] = useState(client?.city || '')
  const [type, setType] = useState<ContactCategory | ''>(client?.type || '')
  const [notes, setNotes] = useState(client?.notes || '')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isEditing = !!client

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }

    startTransition(async () => {
      const data = {
        name: name.trim(),
        email: email || null,
        phone: phone || null,
        address: address || null,
        postal_code: postalCode || null,
        city: city || null,
        type: (type || null) as ContactCategory | null,
        notes: notes || null,
      }

      const result = isEditing
        ? await updateClientAction(client.id, data)
        : await createClientAction(data)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(isEditing ? 'Contact mis a jour' : 'Contact cree')
        router.push('/clients')
      }
    })
  }

  const inputClass = "w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder:text-muted/50"

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-6 max-w-2xl space-y-5">
      {/* Name */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
          Nom *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du contact"
          required
          className={inputClass}
        />
      </div>

      {/* Email / Phone */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemple.fr"
            className={inputClass}
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
            placeholder="06 12 34 56 78"
            className={inputClass}
          />
        </div>
      </div>

      {/* Address */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
          Adresse
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="123 Rue de la Paix"
          className={inputClass}
        />
      </div>

      {/* Postal code / City */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Code postal
          </label>
          <input
            type="text"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            placeholder="75001"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Ville
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Paris"
            className={inputClass}
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
          Categorie
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ContactCategory | '')}
          className={inputClass}
        >
          <option value="">-- Aucune categorie --</option>
          {ALL_CONTACT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes sur le contact..."
          rows={3}
          className={`${inputClass} resize-y`}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3 rounded-lg font-semibold text-white text-sm
          gradient-primary hover:opacity-90 transition-opacity
          disabled:opacity-50 disabled:cursor-not-allowed
          shadow-lg shadow-primary/25"
      >
        {isPending ? 'Enregistrement...' : isEditing ? 'Mettre a jour' : 'Creer le contact'}
      </button>
    </form>
  )
}
