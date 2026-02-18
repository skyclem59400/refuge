import { getGreeting } from '@/lib/utils'

export function WelcomeBanner({ userEmail }: { userEmail: string }) {
  const name = userEmail.split('@')[0]
  const greeting = getGreeting()

  return (
    <div className="rounded-2xl p-6 mb-6 bg-primary/10 border border-primary/20">
      <h2 className="text-2xl font-bold">
        {greeting}, <span className="text-primary-light">{name}</span> !
      </h2>
      <p className="text-muted text-sm mt-1">
        Voici un apercu de votre activite
      </p>
    </div>
  )
}
