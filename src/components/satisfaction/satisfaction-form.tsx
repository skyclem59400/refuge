'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { submitSurveyResponse } from '@/lib/actions/satisfaction'

interface Props {
  token: string
  kind: 'adoption' | 'donation' | 'foster'
  kindLabel: string
  recipientName: string | null
}

const INTRO_BY_KIND: Record<Props['kind'], { greeting: string; cta: string; placeholder: string }> = {
  adoption: {
    greeting: 'Cela fait une semaine que vous avez adopté. Comment ça se passe ?',
    cta: 'Sur une échelle de 0 à 10, recommanderiez-vous la SDA à un proche qui souhaite adopter ?',
    placeholder: 'Ce qui s\'est bien passé, ce qui aurait pu être mieux (accueil, info sur l\'animal, accompagnement…)',
  },
  donation: {
    greeting: 'Merci pour votre don ! Votre soutien fait une vraie différence.',
    cta: 'Sur une échelle de 0 à 10, recommanderiez-vous la SDA à un proche qui souhaite soutenir un refuge ?',
    placeholder: 'Ce qui vous a plu, ce qu\'on peut améliorer (communication, transparence, reçu fiscal…)',
  },
  foster: {
    greeting: 'Cela fait une semaine que vous accueillez un animal. Comment ça se passe ?',
    cta: 'Sur une échelle de 0 à 10, recommanderiez-vous l\'expérience FA à un proche ?',
    placeholder: 'Ce qui fonctionne bien, ce qui pourrait être amélioré dans l\'accompagnement…',
  },
}

export function SatisfactionForm({ token, kind, kindLabel, recipientName }: Props) {
  const router = useRouter()
  const [score, setScore] = useState<number | null>(null)
  const [verbatim, setVerbatim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const config = INTRO_BY_KIND[kind]
  const firstName = recipientName ? recipientName.split(' ')[0] : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (score === null) {
      setError('Merci de sélectionner une note entre 0 et 10.')
      return
    }
    startTransition(async () => {
      const res = await submitSurveyResponse({ token, npsScore: score, verbatim })
      if (res.error) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
      <div>
        <span className="inline-block px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-300 text-[10px] font-semibold uppercase tracking-wider mb-3 border border-teal-500/20">
          {kindLabel}
        </span>
        <p className="text-base text-slate-100 leading-relaxed">
          {firstName ? `Bonjour ${firstName}, ` : ''}{config.greeting}
        </p>
      </div>

      <div>
        <p className="text-sm text-slate-300 mb-3">{config.cta}</p>
        <div className="grid grid-cols-11 gap-1.5">
          {Array.from({ length: 11 }).map((_, i) => {
            const isSelected = score === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => setScore(i)}
                className={`aspect-square flex items-center justify-center rounded-lg font-bold text-sm transition-all border ${
                  isSelected
                    ? 'bg-teal-500 text-white border-teal-400 scale-110'
                    : i <= 6
                      ? 'bg-slate-800/70 text-slate-300 border-slate-700 hover:border-orange-400/50'
                      : i <= 8
                        ? 'bg-slate-800/70 text-slate-300 border-slate-700 hover:border-yellow-400/50'
                        : 'bg-slate-800/70 text-slate-300 border-slate-700 hover:border-emerald-400/50'
                }`}
              >
                {i}
              </button>
            )
          })}
        </div>
        <div className="flex justify-between mt-2 text-[11px] text-slate-500">
          <span>Pas du tout</span>
          <span>Carrément oui</span>
        </div>
      </div>

      <div>
        <label htmlFor="verbatim" className="block text-sm text-slate-300 mb-2">
          Qu&apos;est-ce qu&apos;on aurait pu mieux faire ? <span className="text-slate-500">(optionnel mais précieux)</span>
        </label>
        <textarea
          id="verbatim"
          value={verbatim}
          onChange={(e) => setVerbatim(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder={config.placeholder}
          className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors resize-y"
        />
        <p className="text-[11px] text-slate-500 mt-1">{verbatim.length} / 2000 caractères</p>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-sm text-orange-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || score === null}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-teal-500 hover:bg-teal-400 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send className="w-4 h-4" />
        {isPending ? 'Envoi en cours…' : 'Envoyer ma réponse'}
      </button>
    </form>
  )
}
