'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { updateProfile, updateEmail } from '@/lib/actions/account'
import { AvatarUpload } from '@/components/account/avatar-upload'

interface AccountFormProps {
  userId: string
  userEmail: string
  fullName: string | null
  avatarUrl: string | null
}

export function AccountForm({ userId, userEmail, fullName, avatarUrl }: AccountFormProps) {
  const [name, setName] = useState(fullName || '')
  const [email, setEmail] = useState(userEmail)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()

    startTransition(async () => {
      const result = await updateProfile({ full_name: name.trim() })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Profil mis a jour')
        router.refresh()
      }
    })
  }

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()

    if (!trimmed) {
      toast.error('L\'email est obligatoire')
      return
    }

    if (trimmed === userEmail) {
      toast.error('C\'est deja votre adresse email')
      return
    }

    startTransition(async () => {
      const result = await updateEmail(trimmed)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Un email de confirmation a ete envoye a la nouvelle adresse')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Profile section */}
      <form onSubmit={handleProfileSubmit} className="bg-surface rounded-xl border border-border p-6 space-y-5">
        <h2 className="text-lg font-bold">Profil</h2>

        <AvatarUpload
          userId={userId}
          currentAvatarUrl={avatarUrl}
          userEmail={userEmail}
        />

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Nom complet
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Votre nom"
            className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors
              placeholder:text-muted/50"
          />
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

      {/* Email section */}
      <form onSubmit={handleEmailSubmit} className="bg-surface rounded-xl border border-border p-6 space-y-5">
        <h2 className="text-lg font-bold">Adresse email</h2>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
              focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
          <p className="text-xs text-muted mt-1.5">
            Un email de confirmation sera envoye a la nouvelle adresse.
          </p>
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
            {isPending ? 'Modification...' : 'Modifier l\'email'}
          </button>
        </div>
      </form>
    </div>
  )
}
