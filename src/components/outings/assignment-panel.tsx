'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Check,
  ClipboardList,
  Loader2,
  PawPrint,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { createAssignment, deleteAssignment } from '@/lib/actions/outings'

interface Assignment {
  id: string
  animal_id: string
  assigned_to: string
  assigned_by: string
  date: string
  outing_id: string | null
  notes: string | null
  animals: {
    id: string
    name: string
    species: string
    photo_url: string | null
    establishment_id: string
    animal_photos: { id: string; url: string; is_primary: boolean }[]
  }
}

interface MemberInfo {
  user_id: string
  full_name: string | null
  email?: string
  pseudo: string | null
}

interface AnimalOption {
  id: string
  name: string
  species: string
}

interface AssignmentPanelProps {
  assignments: Assignment[]
  members: MemberInfo[]
  animals: AnimalOption[]
  userNames: Record<string, string>
}

export default function AssignmentPanel({
  assignments,
  members,
  animals,
  userNames,
}: AssignmentPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(true)
  const [selectedMember, setSelectedMember] = useState('')
  const [selectedAnimal, setSelectedAnimal] = useState('')
  const [assignNotes, setAssignNotes] = useState('')

  // Filter animals: exclude those already assigned to selectedMember today
  const availableAnimals = animals.filter(
    (a) =>
      !assignments.some(
        (asgn) => asgn.animal_id === a.id && asgn.assigned_to === selectedMember
      )
  )

  // Group assignments by assigned_to
  const groupedAssignments = assignments.reduce<Record<string, Assignment[]>>(
    (groups, assignment) => {
      const key = assignment.assigned_to
      if (!groups[key]) groups[key] = []
      groups[key].push(assignment)
      return groups
    },
    {}
  )

  function getMemberDisplayName(userId: string): string {
    // Validate UUID format to prevent displaying animal IDs or names
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
    if (!isValidUUID) {
      console.warn(`Invalid user ID format: ${userId}`)
      return 'ID invalide'
    }

    if (userNames[userId]) return userNames[userId]
    const member = members.find((m) => m.user_id === userId)
    if (member) {
      return member.full_name || member.pseudo || member.email || userId
    }
    return userId
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMember || !selectedAnimal) return

    startTransition(async () => {
      const result = await createAssignment({
        animal_id: selectedAnimal,
        assigned_to: selectedMember,
        notes: assignNotes || null,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Assignation creee')
        setSelectedAnimal('')
        setAssignNotes('')
        router.refresh()
      }
    })
  }

  async function handleDelete(id: string, animalName: string) {
    if (!confirm(`Retirer l&apos;assignation de ${animalName} ?`)) return
    startTransition(async () => {
      const result = await deleteAssignment(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Assignation retiree')
        router.refresh()
      }
    })
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-text">Assignations du jour</h2>
          <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {assignments.length}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted" />
        )}
      </button>

      {isOpen && (
        <div className="mt-4 space-y-4">
          {/* Assignment form */}
          <form onSubmit={handleAssign} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Select member */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  <User className="mr-1 inline h-3.5 w-3.5" />
                  Membre
                </label>
                <select
                  value={selectedMember}
                  onChange={(e) => {
                    setSelectedMember(e.target.value)
                    setSelectedAnimal('')
                  }}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="">Selectionner un membre</option>
                  {members.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {getMemberDisplayName(member.user_id)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select animal */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  <PawPrint className="mr-1 inline h-3.5 w-3.5" />
                  Animal
                </label>
                <select
                  value={selectedAnimal}
                  onChange={(e) => setSelectedAnimal(e.target.value)}
                  disabled={!selectedMember}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
                >
                  <option value="">Selectionner un animal</option>
                  {availableAnimals.map((animal) => (
                    <option key={animal.id} value={animal.id}>
                      {animal.name} ({animal.species})
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Notes (optionnel)
                </label>
                <input
                  type="text"
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Notes..."
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!selectedMember || !selectedAnimal || isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Assigner
            </button>
          </form>

          {/* Assignments grouped by person */}
          {Object.keys(groupedAssignments).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(groupedAssignments).map(([userId, userAssignments]) => (
                <div key={userId} className="rounded-lg border border-border bg-surface-hover p-3">
                  {/* Group header */}
                  <div className="mb-2 flex items-center gap-2">
                    <User className="h-4 w-4 text-muted" />
                    <span className="text-sm font-medium text-text">
                      {getMemberDisplayName(userId)}
                    </span>
                    <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                      {userAssignments.length}
                    </span>
                  </div>

                  {/* Animal badges */}
                  <div className="flex flex-wrap gap-2">
                    {userAssignments.map((assignment) => {
                      const isCompleted = assignment.outing_id !== null
                      const today = new Date().toISOString().split('T')[0]
                      const isOverdue = !isCompleted && assignment.date < today
                      return (
                        <span
                          key={assignment.id}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                            isCompleted
                              ? 'bg-success/10 text-success'
                              : isOverdue
                                ? 'bg-warning/10 text-warning'
                                : 'bg-primary/10 text-primary'
                          }`}
                        >
                          <PawPrint className="h-3 w-3" />
                          {assignment.animals.name}
                          {isOverdue && (
                            <span className="text-[10px] opacity-75">
                              J+{Math.round((new Date(today).getTime() - new Date(assignment.date).getTime()) / 86400000)}
                            </span>
                          )}
                          {isCompleted ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <button
                              onClick={() =>
                                handleDelete(assignment.id, assignment.animals.name)
                              }
                              disabled={isPending}
                              className="ml-0.5 rounded-full p-0.5 text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                              title="Retirer cette assignation"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted">
              Aucune assignation pour aujourd&apos;hui
            </p>
          )}
        </div>
      )}
    </div>
  )
}
