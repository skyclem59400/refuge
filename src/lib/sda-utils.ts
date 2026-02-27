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
    pound: 'Fourrière', shelter: 'Refuge', foster_family: 'Famille d\'accueil', boarding: 'Pension',
    adopted: 'Adopté', returned: 'Restitué', transferred: 'Transféré', deceased: 'Décédé', euthanized: 'Euthanasié',
  }
  return labels[status] || status
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pound: 'bg-warning/15 text-warning', shelter: 'bg-info/15 text-info',
    foster_family: 'bg-violet-500/15 text-violet-500', boarding: 'bg-teal-500/15 text-teal-500',
    adopted: 'bg-success/15 text-success', returned: 'bg-success/15 text-success',
    transferred: 'bg-secondary/15 text-secondary',
    deceased: 'bg-error/15 text-error', euthanized: 'bg-error/15 text-error',
  }
  return colors[status] || 'bg-muted/15 text-muted'
}

export function getStatusColorOverlay(status: string): string {
  const colors: Record<string, string> = {
    pound: 'bg-warning text-white shadow-sm', shelter: 'bg-info text-white shadow-sm',
    foster_family: 'bg-violet-500 text-white shadow-sm', boarding: 'bg-teal-500 text-white shadow-sm',
    adopted: 'bg-success text-white shadow-sm', returned: 'bg-success text-white shadow-sm',
    transferred: 'bg-secondary text-white shadow-sm',
    deceased: 'bg-error text-white shadow-sm', euthanized: 'bg-error text-white shadow-sm',
  }
  return colors[status] || 'bg-muted text-white shadow-sm'
}

export function getOriginLabel(origin: string): string {
  const labels: Record<string, string> = {
    found: 'Trouvé', abandoned: 'Abandonné',
    transferred_in: 'Transféré (entrant)', surrender: 'Remis volontairement',
    requisition: 'Réquisition', divagation: 'Divagation',
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

export function getIcadDeclarationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    pound_entry: 'Entree en fourriere', shelter_transfer: 'Transfert en refuge',
    adoption: 'Adoption', return_to_owner: 'Restitution proprietaire',
    transfer_out: 'Transfert sortant', death: 'Deces', euthanasia: 'Euthanasie',
    identification: 'Identification', owner_change: 'Changement proprietaire',
    address_change: 'Changement adresse',
  }
  return labels[type] || type
}

export function getIcadStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'En attente', submitted: 'Soumise', confirmed: 'Confirmee',
    rejected: 'Rejetee', error: 'Erreur', not_required: 'Non requise',
  }
  return labels[status] || status
}

export function getIcadStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-warning/15 text-warning', submitted: 'bg-info/15 text-info',
    confirmed: 'bg-success/15 text-success', rejected: 'bg-error/15 text-error',
    error: 'bg-error/15 text-error', not_required: 'bg-muted/15 text-muted',
  }
  return colors[status] || 'bg-muted/15 text-muted'
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

export function getCategoryLabel(category: string | null): string {
  const labels: Record<string, string> = {
    client: 'Client', member: 'Adhérent', volunteer: 'Bénévole',
    board_member: 'Membre CA', foster_family: 'Famille d\'accueil', veterinarian: 'Vétérinaire',
  }
  return category ? labels[category] || category : '-'
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    client: 'bg-secondary/15 text-secondary', member: 'bg-primary/15 text-primary',
    volunteer: 'bg-success/15 text-success', board_member: 'bg-warning/15 text-warning',
    foster_family: 'bg-violet-500/15 text-violet-500', veterinarian: 'bg-teal-500/15 text-teal-500',
  }
  return colors[category] || 'bg-muted/15 text-muted'
}

export const ALL_CONTACT_CATEGORIES = ['client', 'member', 'volunteer', 'board_member', 'foster_family', 'veterinarian'] as const

// ============================================
// Social Posts Helpers
// ============================================

export function getSocialPostTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    search_owner: 'Recherche proprietaire',
    adoption: 'A l\'adoption',
    event: 'Evenement',
    info: 'Information',
    other: 'Autre',
  }
  return labels[type] || type
}

export function getSocialPostStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Brouillon',
    scheduled: 'Programme',
    publishing: 'Publication...',
    published: 'Publie',
    failed: 'Echec',
    archived: 'Archive',
  }
  return labels[status] || status
}

export function getSocialPostStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-muted/15 text-muted',
    scheduled: 'bg-info/15 text-info',
    publishing: 'bg-warning/15 text-warning',
    published: 'bg-success/15 text-success',
    failed: 'bg-error/15 text-error',
    archived: 'bg-muted/15 text-muted',
  }
  return colors[status] || 'bg-muted/15 text-muted'
}

export function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    both: 'Facebook + Instagram',
  }
  return labels[platform] || platform
}

// ============================================
// Phone Agent System
// ============================================

export function getCallStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ringing: 'Sonne',
    in_progress: 'En cours',
    completed: 'Termine',
    failed: 'Echoue',
    voicemail: 'Repondeur',
    no_answer: 'Pas de reponse',
  }
  return labels[status] || status
}

export function getCallStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ringing: 'text-amber-500 bg-amber-500/10',
    in_progress: 'text-green-500 bg-green-500/10',
    completed: 'text-muted bg-muted/10',
    failed: 'text-red-500 bg-red-500/10',
    voicemail: 'text-purple-500 bg-purple-500/10',
    no_answer: 'text-muted bg-muted/10',
  }
  return colors[status] || 'text-muted bg-muted/10'
}

export function getAgentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    idle: 'Disponible',
    in_call: 'En appel',
    processing: 'Traitement',
  }
  return labels[status] || status
}

export function getSentimentLabel(sentiment: string): string {
  const labels: Record<string, string> = {
    positive: 'Positif',
    neutral: 'Neutre',
    negative: 'Negatif',
  }
  return labels[sentiment] || sentiment
}

export function getSentimentColor(sentiment: string): string {
  const colors: Record<string, string> = {
    positive: 'text-green-500 bg-green-500/10',
    neutral: 'text-muted bg-muted/10',
    negative: 'text-red-500 bg-red-500/10',
  }
  return colors[sentiment] || 'text-muted bg-muted/10'
}

export function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function maskPhone(phone: string): string {
  if (phone.length <= 6) return phone
  return phone.slice(0, 6) + ' ** ** ' + phone.slice(-2)
}
