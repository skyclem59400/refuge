'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateDeclarationStatus } from '@/lib/actions/icad'
import { getIcadStatusLabel } from '@/lib/sda-utils'
import type { IcadDeclarationStatus } from '@/lib/types/database'

interface IcadActionButtonsProps {
  declarationId: string
  currentStatus: IcadDeclarationStatus
}

export function IcadActionButtons({ declarationId, currentStatus }: IcadActionButtonsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleStatusChange(status: IcadDeclarationStatus) {
    startTransition(async () => {
      const result = await updateDeclarationStatus(declarationId, status)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Statut mis a jour : ${getIcadStatusLabel(status)}`)
        router.refresh()
      }
    })
  }

  if (currentStatus === 'confirmed' || currentStatus === 'not_required') {
    return null
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {(currentStatus === 'pending' || currentStatus === 'error') && (
        <button
          onClick={() => handleStatusChange('submitted')}
          disabled={isPending}
          className="px-2 py-1 rounded text-xs font-medium bg-info/10 text-info hover:bg-info/20 transition-colors disabled:opacity-50"
        >
          Soumise
        </button>
      )}
      {(currentStatus === 'pending' || currentStatus === 'submitted' || currentStatus === 'error') && (
        <button
          onClick={() => handleStatusChange('confirmed')}
          disabled={isPending}
          className="px-2 py-1 rounded text-xs font-medium bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
        >
          Confirmee
        </button>
      )}
      <button
        onClick={() => handleStatusChange('not_required')}
        disabled={isPending}
        className="px-2 py-1 rounded text-xs font-medium bg-muted/10 text-muted hover:bg-muted/20 transition-colors disabled:opacity-50"
      >
        N/A
      </button>
    </div>
  )
}
