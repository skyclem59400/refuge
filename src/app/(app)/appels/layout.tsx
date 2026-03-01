import { Phone } from 'lucide-react'
import { CallsTabs } from '@/components/calls/calls-tabs'

export default function AppelsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Phone className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Appels telephoniques</h1>
          <p className="text-sm text-muted mt-1">Accueil & Agents IA</p>
        </div>
      </div>
      <CallsTabs />
      {children}
    </div>
  )
}
