import { CheckCircle2, AlertCircle } from 'lucide-react'
import { getSurveyByToken } from '@/lib/actions/satisfaction'
import { SatisfactionForm } from '@/components/satisfaction/satisfaction-form'
import { SATISFACTION_KIND_LABELS } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function SatisfactionPage({ params }: PageProps) {
  const { token } = await params
  const res = await getSurveyByToken(token)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Bandeau marque */}
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Refuge SDA d&apos;Estourmel</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-100">Votre avis nous aide à progresser</h1>
        </div>

        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          {res.error || !res.data ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-100 mb-2">Lien invalide</h2>
              <p className="text-sm text-slate-400">{res.error || 'Cette enquête est introuvable.'}</p>
            </div>
          ) : res.data.completed_at ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-100 mb-2">Merci, votre réponse est enregistrée</h2>
              <p className="text-sm text-slate-400">
                Vous avez répondu à cette enquête le {new Date(res.data.completed_at).toLocaleDateString('fr-FR')}.
                Toute l&apos;équipe vous remercie d&apos;avoir pris le temps.
              </p>
            </div>
          ) : (
            <SatisfactionForm
              token={res.data.token}
              kind={res.data.kind}
              recipientName={res.data.recipient_name}
              kindLabel={SATISFACTION_KIND_LABELS[res.data.kind]}
            />
          )}
        </div>

        {/* Footer charte */}
        <div className="mt-6 h-1 rounded-full bg-gradient-to-r from-orange-500 via-teal-500 to-blue-900" />
        <p className="mt-4 text-center text-[11px] text-slate-500">
          Vos retours sont lus personnellement par l&apos;équipe SDA. Nous ne les partageons avec personne.
        </p>
      </div>
    </div>
  )
}
