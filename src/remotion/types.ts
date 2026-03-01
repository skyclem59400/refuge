export interface VideoProps {
  postType: 'adoption' | 'search_owner' | 'event' | 'info' | 'other'
  animalName?: string
  animalSpecies?: string
  photoUrls: string[]
  content: string
  establishmentName: string
  establishmentPhone: string
  logoUrl?: string
  videoText?: string
  musicUrl?: string
}

// Video specs
export const VIDEO_WIDTH = 1080
export const VIDEO_HEIGHT = 1080
export const VIDEO_FPS = 30
export const VIDEO_DURATION_FRAMES = 300 // 10 seconds

// Color palette per post type
export const POST_TYPE_COLORS: Record<VideoProps['postType'], { primary: string; gradient: [string, string] }> = {
  adoption: { primary: '#10b981', gradient: ['#10b981', '#059669'] },
  search_owner: { primary: '#f59e0b', gradient: ['#f59e0b', '#d97706'] },
  event: { primary: '#8b5cf6', gradient: ['#8b5cf6', '#7c3aed'] },
  info: { primary: '#3b82f6', gradient: ['#3b82f6', '#2563eb'] },
  other: { primary: '#6366f1', gradient: ['#6366f1', '#4f46e5'] },
}

export const POST_TYPE_TITLES: Record<VideoProps['postType'], string> = {
  adoption: 'A L\'ADOPTION',
  search_owner: 'RECHERCHE PROPRIETAIRE',
  event: 'EVENEMENT',
  info: 'INFO',
  other: '',
}
