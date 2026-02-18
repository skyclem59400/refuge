'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updatePassword } from '@/lib/actions/account'

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Tous les champs sont obligatoires')
      return
    }

    if (newPassword.length < 8) {
      toast.error('Le nouveau mot de passe doit faire au moins 8 caracteres')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }

    startTransition(async () => {
      const result = await updatePassword(currentPassword, newPassword)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Mot de passe mis a jour')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-6 space-y-5">
      <h2 className="text-lg font-bold">Mot de passe</h2>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
          Mot de passe actuel
        </label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
            focus:border-primary focus:ring-1 focus:ring-primary transition-colors
            placeholder:text-muted/50"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
          Nouveau mot de passe
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full px-4 py-2.5 bg-surface-dark border border-border rounded-lg text-sm
            focus:border-primary focus:ring-1 focus:ring-primary transition-colors
            placeholder:text-muted/50"
        />
        <p className="text-xs text-muted mt-1.5">Minimum 8 caracteres.</p>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
          Confirmer le nouveau mot de passe
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          required
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
          {isPending ? 'Modification...' : 'Modifier le mot de passe'}
        </button>
      </div>
    </form>
  )
}
