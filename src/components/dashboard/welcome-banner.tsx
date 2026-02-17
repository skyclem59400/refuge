import { getGreeting } from '@/lib/utils'

export function WelcomeBanner({ userEmail }: { userEmail: string }) {
  const name = userEmail.split('@')[0]
  const greeting = getGreeting()

  return (
    <div className="rounded-2xl p-6 mb-6"
      style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(236,72,153,0.1) 100%)' }}>
      <h2 className="text-2xl font-bold">
        {greeting}, <span className="gradient-text">{name}</span> !
      </h2>
      <p className="text-muted text-sm mt-1">
        Voici un apercu de votre activite
      </p>
    </div>
  )
}
