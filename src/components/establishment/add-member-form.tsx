'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { addMember } from '@/lib/actions/establishments'

export function AddMemberForm() {
  const [email, setEmail] = useState('')
  const [manageDocuments, setManageDocuments] = useState(false)
  const [manageClients, setManageClients] = useState(false)
  const [manageEstablishment, setManageEstablishment] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      toast.error('Veuillez saisir un email')
      return
    }

    startTransition(async () => {
      const result = await addMember(email.trim(), {
        manage_documents: manageDocuments,
        manage_clients: manageClients,
        manage_establishment: manageEstablishment,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Membre ajoute avec succes')
        setEmail('')
        setManageDocuments(false)
        setManageClients(false)
        setManageEstablishment(false)
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-surface-dark rounded-lg border border-border space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
          Email du membre
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="utilisateur@exemple.fr"
          required
          className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-sm
            focus:border-primary focus:ring-1 focus:ring-primary transition-colors
            placeholder:text-muted/50"
        />
        <p className="text-xs text-muted mt-1">
          L&apos;utilisateur doit deja avoir un compte sur la plateforme.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
          Permissions
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={manageDocuments}
              onChange={(e) => setManageDocuments(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm">Documents</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={manageClients}
              onChange={(e) => setManageClients(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm">Clients</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={manageEstablishment}
              onChange={(e) => setManageEstablishment(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm">Administration</span>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 rounded-lg font-semibold text-white text-sm
          bg-primary hover:bg-primary-dark transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Ajout...' : 'Ajouter le membre'}
      </button>
    </form>
  )
}
