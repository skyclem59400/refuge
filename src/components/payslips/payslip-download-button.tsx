'use client'

import { useState } from 'react'
import { getPayslipSignedUrl } from '@/lib/actions/payslips'
import { toast } from 'sonner'

interface PayslipDownloadButtonProps {
  readonly payslipId: string
  readonly label?: string
}

export function PayslipDownloadButton({ payslipId, label }: PayslipDownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleDownload = async () => {
    setIsLoading(true)
    try {
      const result = await getPayslipSignedUrl(payslipId)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      if ('data' in result && result.data) {
        window.open(result.data, '_blank')
      }
    } catch {
      toast.error('Erreur lors du telechargement')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isLoading}
      className="text-xs text-primary hover:text-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? 'Chargement...' : (label || 'Telecharger')}
    </button>
  )
}
