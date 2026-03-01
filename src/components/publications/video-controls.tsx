'use client'

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Sparkles, Loader2, Music, Play, Pause, Check, Search, RefreshCw, AlertCircle } from 'lucide-react'
import type { VideoProps } from '@/remotion/types'

interface MusicTrack {
  id: string
  title: string
  artist: string
  duration: number
  audioUrl: string
  downloadUrl: string
  imageUrl: string
  tags: string[]
  moods: string[]
}

interface VideoControlsProps {
  videoText: string
  onVideoTextChange: (text: string) => void
  musicUrl: string | null
  musicTitle: string
  onMusicChange: (url: string, title: string) => void
  postType: VideoProps['postType']
  isGeneratingText: boolean
  onRegenerateText: (hint?: string) => void
}

const MOOD_CHIPS = [
  { id: 'joyeux', label: 'Joyeux' },
  { id: 'calme', label: 'Calme' },
  { id: 'energique', label: 'Energique' },
  { id: 'emotionnel', label: 'Emotionnel' },
  { id: 'triste', label: 'Triste' },
  { id: 'festif', label: 'Festif' },
]

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VideoControls({
  videoText,
  onVideoTextChange,
  musicUrl,
  musicTitle,
  onMusicChange,
  postType,
  isGeneratingText,
  onRegenerateText,
}: VideoControlsProps) {
  const [showHintInput, setShowHintInput] = useState(false)
  const [hint, setHint] = useState('')
  const [showMusicBrowser, setShowMusicBrowser] = useState(false)
  const [musicSearch, setMusicSearch] = useState('')
  const [tracks, setTracks] = useState<MusicTrack[]>([])
  const [isLoadingMusic, setIsLoadingMusic] = useState(false)
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null)
  const [activeMood, setActiveMood] = useState<string | null>(null)
  const [musicError, setMusicError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  async function searchMusic(params: { q?: string; mood?: string; postType?: string }) {
    setIsLoadingMusic(true)
    setMusicError(null)
    try {
      const searchParams = new URLSearchParams()
      if (params.q) searchParams.set('q', params.q)
      if (params.mood) searchParams.set('mood', params.mood)
      if (params.postType) searchParams.set('postType', params.postType)

      const response = await fetch(`/api/music/search?${searchParams.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        const errMsg = data.error || `Erreur ${response.status}`
        setMusicError(errMsg)
        toast.error(errMsg)
        return
      }

      if (data.tracks) {
        setTracks(data.tracks)
        if (data.tracks.length === 0) {
          setMusicError('Aucun resultat pour cette recherche')
        }
      }
    } catch (err) {
      console.error('Music search error:', err)
      setMusicError('Erreur reseau lors de la recherche')
      toast.error('Erreur reseau lors de la recherche musicale')
    } finally {
      setIsLoadingMusic(false)
    }
  }

  function handleMoodClick(moodId: string) {
    setActiveMood(moodId)
    setMusicSearch('')
    searchMusic({ mood: moodId })
  }

  function handleMusicSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!musicSearch.trim()) return
    setActiveMood(null)
    searchMusic({ q: musicSearch })
  }

  function handleOpenMusicBrowser() {
    setShowMusicBrowser(true)
    if (tracks.length === 0) {
      searchMusic({ postType })
    }
  }

  function handlePreviewTrack(track: MusicTrack) {
    if (playingTrackId === track.id) {
      // Stop playing
      audioRef.current?.pause()
      setPlayingTrackId(null)
      return
    }

    // Play new track
    if (audioRef.current) {
      audioRef.current.pause()
    }
    const audio = new Audio(track.audioUrl)
    audio.volume = 0.5
    audio.play()
    audio.onended = () => setPlayingTrackId(null)
    audioRef.current = audio
    setPlayingTrackId(track.id)
  }

  function handleSelectTrack(track: MusicTrack) {
    // Stop preview if playing
    if (audioRef.current) {
      audioRef.current.pause()
      setPlayingTrackId(null)
    }
    onMusicChange(track.audioUrl, `${track.title} - ${track.artist}`)
    setShowMusicBrowser(false)
  }

  function handleRegenerateWithHint() {
    if (!hint.trim()) return
    onRegenerateText(hint)
    setHint('')
    setShowHintInput(false)
  }

  const charCount = videoText.length
  const isOverLimit = charCount > 80

  return (
    <div className="space-y-4 mt-4">
      {/* Video Text Section */}
      <div className="bg-surface-hover/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Texte de la video
          </h4>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onRegenerateText()}
              disabled={isGeneratingText}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {isGeneratingText ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Regenerer
            </button>
            <button
              onClick={() => setShowHintInput(!showHintInput)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted hover:bg-surface-hover transition-colors"
            >
              Orienter
            </button>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={videoText}
            onChange={(e) => onVideoTextChange(e.target.value)}
            rows={2}
            placeholder="Texte court pour la video..."
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
          <span className={`absolute bottom-2 right-2 text-xs ${isOverLimit ? 'text-red-500 font-semibold' : 'text-muted'}`}>
            {charCount}/80
          </span>
        </div>

        {showHintInput && (
          <div className="flex gap-2">
            <input
              type="text"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Ex: plus emotionnel, plus court, mentionner l'age..."
              className="flex-1 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
              onKeyDown={(e) => e.key === 'Enter' && handleRegenerateWithHint()}
            />
            <button
              onClick={handleRegenerateWithHint}
              disabled={isGeneratingText || !hint.trim()}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {isGeneratingText ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
            </button>
          </div>
        )}
      </div>

      {/* Music Section */}
      <div className="bg-surface-hover/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Music className="w-4 h-4 text-primary" />
            Musique de fond
          </h4>
          <button
            onClick={handleOpenMusicBrowser}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            {musicUrl ? 'Changer' : 'Choisir'}
          </button>
        </div>

        {musicUrl && musicTitle && (
          <div className="flex items-center gap-3 p-2 bg-surface rounded-lg border border-border">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Music className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{musicTitle}</p>
              <p className="text-xs text-muted">Libre de droits - Jamendo</p>
            </div>
          </div>
        )}

        {!musicUrl && !showMusicBrowser && (
          <p className="text-xs text-muted">Aucune musique selectionnee</p>
        )}

        {/* Music Browser */}
        {showMusicBrowser && (
          <div className="space-y-3 border border-border rounded-lg p-3 bg-surface">
            {/* Mood chips */}
            <div className="flex flex-wrap gap-1.5">
              {MOOD_CHIPS.map((mood) => (
                <button
                  key={mood.id}
                  onClick={() => handleMoodClick(mood.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    activeMood === mood.id
                      ? 'bg-primary text-white'
                      : 'bg-surface-hover hover:bg-primary/10 text-muted hover:text-primary'
                  }`}
                >
                  {mood.label}
                </button>
              ))}
            </div>

            {/* Search bar */}
            <form onSubmit={handleMusicSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                <input
                  type="text"
                  value={musicSearch}
                  onChange={(e) => setMusicSearch(e.target.value)}
                  placeholder="Rechercher une musique..."
                  className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <button
                type="submit"
                disabled={!musicSearch.trim()}
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                Chercher
              </button>
            </form>

            {/* Results */}
            {isLoadingMusic && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            )}

            {!isLoadingMusic && tracks.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {tracks.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-hover transition-colors group"
                  >
                    <button
                      onClick={() => handlePreviewTrack(track)}
                      className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 hover:bg-primary/20 transition-colors"
                    >
                      {playingTrackId === track.id ? (
                        <Pause className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <Play className="w-3.5 h-3.5 text-primary ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{track.title}</p>
                      <p className="text-xs text-muted truncate">{track.artist} · {formatDuration(track.duration)}</p>
                    </div>
                    <button
                      onClick={() => handleSelectTrack(track)}
                      className="px-2 py-1 rounded-md text-xs font-medium text-primary opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-all flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Choisir
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!isLoadingMusic && tracks.length === 0 && (
              <div className="text-center py-3">
                {musicError ? (
                  <p className="text-xs text-red-400 flex items-center justify-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {musicError}
                  </p>
                ) : (
                  <p className="text-xs text-muted">
                    Selectionnez une ambiance ou recherchez une musique
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
