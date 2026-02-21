export function getSpeciesLabel(species: string): string {
  const labels: Record<string, string> = { cat: 'Chat', dog: 'Chien' }
  return labels[species] || species
}

export function getSexLabel(sex: string): string {
  const labels: Record<string, string> = { male: 'Mâle', female: 'Femelle', unknown: 'Inconnu' }
  return labels[sex] || sex
}

export function getSexIcon(sex: string): string {
  const icons: Record<string, string> = { male: '♂', female: '♀', unknown: '?' }
  return icons[sex] || '?'
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pound: 'Fourrière', shelter: 'Refuge', adopted: 'Adopté', returned: 'Restitué',
    transferred: 'Transféré', deceased: 'Décédé', euthanized: 'Euthanasié',
  }
  return labels[status] || status
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pound: 'bg-warning/15 text-warning', shelter: 'bg-info/15 text-info',
    adopted: 'bg-success/15 text-success', returned: 'bg-success/15 text-success',
    transferred: 'bg-secondary/15 text-secondary',
    deceased: 'bg-error/15 text-error', euthanized: 'bg-error/15 text-error',
  }
  return colors[status] || 'bg-muted/15 text-muted'
}

export function getOriginLabel(origin: string): string {
  const labels: Record<string, string> = {
    found: 'Trouvé', abandoned: 'Abandonné',
    transferred_in: 'Transféré (entrant)', surrender: 'Remis volontairement',
  }
  return labels[origin] || origin
}

export function getMovementLabel(type: string): string {
  const labels: Record<string, string> = {
    pound_entry: 'Entrée en fourrière', shelter_transfer: 'Transfert en refuge',
    adoption: 'Adoption', return_to_owner: 'Restitution au propriétaire',
    transfer_out: 'Transfert vers autre refuge', death: 'Décès', euthanasia: 'Euthanasie',
  }
  return labels[type] || type
}

export function getHealthTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    vaccination: 'Vaccination', sterilization: 'Stérilisation',
    antiparasitic: 'Antiparasitaire', consultation: 'Consultation',
    surgery: 'Chirurgie', medication: 'Médicament',
    behavioral_assessment: 'Bilan comportemental',
  }
  return labels[type] || type
}

export function calculateAge(birthDate: string | null): string {
  if (!birthDate) return 'Âge inconnu'
  const birth = new Date(birthDate)
  const now = new Date()
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (months < 1) return "Moins d'1 mois"
  if (months < 12) return `${months} mois`
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  if (remainingMonths === 0) return `${years} an${years > 1 ? 's' : ''}`
  return `${years} an${years > 1 ? 's' : ''} et ${remainingMonths} mois`
}

export function calculateBusinessDays(startDate: string, endDate?: string): number {
  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : new Date()
  let count = 0
  const current = new Date(start)
  current.setDate(current.getDate() + 1)
  while (current <= end) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) count++
    current.setDate(current.getDate() + 1)
  }
  return count
}
