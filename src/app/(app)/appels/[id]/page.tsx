import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getEstablishmentContext } from '@/lib/establishment/context'
import { getCallById, getCallTranscripts } from '@/lib/actions/calls'
import { CallDetail } from '@/components/calls/call-detail'

export default async function AppelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getEstablishmentContext()
  if (!ctx) redirect('/login')

  const [callResult, transcriptsResult] = await Promise.all([
    getCallById(id),
    getCallTranscripts(id),
  ])

  if (callResult.error || !callResult.data) {
    notFound()
  }

  const call = callResult.data
  const transcripts = transcriptsResult.data || []

  return (
    <div className="animate-fade-up">
      {/* Back link */}
      <Link
        href="/appels"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-text transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux appels
      </Link>

      <CallDetail call={call} transcripts={transcripts} />
    </div>
  )
}
