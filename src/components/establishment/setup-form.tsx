'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createEstablishment } from '@/lib/actions/establishments'
import { switchEstablishment } from '@/lib/actions/switch-establishment'

export function SetupForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [legalName, setLegalName] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Le nom est obligatoire')
      return
    }

    startTransition(async () => {
      const result = await createEstablishment({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        legal_name: legalName.trim() || undefined,
      })

      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        await switchEstablishment(result.data.id)
        toast.success('Etablissement cree avec succes')
        router.push('/dashboard')
        router.refresh()
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-dark">
      <div className="w-full max-w-lg animate-fade-up">
        <div className="bg-surface rounded-2xl p-8 glow border border-border">
          <div className="text-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Logo" className="w-16 h-16 rounded-full mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-primary-light">Bienvenue</h1>
            <p className="text-muted text-sm mt-1">
              Creez votre premier etablissement pour commencer
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Nom de l&apos;etablissement *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: La Ferme O 4 Vents"
                required
                className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                  focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                  placeholder:text-muted/50"
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
                placeholder="Nom legal (si different)"
                className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                  focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                  placeholder:text-muted/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@exemple.fr"
                  className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                    focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                    placeholder:text-muted/50"
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
                  className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                    focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                    placeholder:text-muted/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Adresse
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="12 rue de la Ferme, 59000 Lille"
                className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
                  focus:border-primary focus:ring-1 focus:ring-primary transition-colors
                  placeholder:text-muted/50"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 rounded-lg font-semibold text-white text-sm
                  gradient-primary hover:opacity-90 transition-opacity
                  disabled:opacity-50 disabled:cursor-not-allowed
                  shadow-lg shadow-primary/25"
              >
                {isPending ? 'Creation...' : 'Creer mon etablissement'}
              </button>
            </div>

            <p className="text-xs text-muted text-center">
              Vous pourrez completer les informations plus tard dans les parametres.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
