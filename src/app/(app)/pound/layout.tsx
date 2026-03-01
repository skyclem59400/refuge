import { Warehouse } from 'lucide-react'
import { PoundTabs } from '@/components/pound/pound-tabs'

export default function PoundLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-warning/15">
          <Warehouse className="w-6 h-6 text-warning" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Fourriere</h1>
        </div>
      </div>

      {/* Tabs */}
      <PoundTabs />

      {/* Content */}
      {children}
    </div>
  )
}
