'use client'

import { useMemo } from 'react'
import { Player } from '@remotion/player'
import { COMPOSITION_MAP } from '@/remotion'
import { VIDEO_WIDTH, VIDEO_HEIGHT, VIDEO_FPS, VIDEO_DURATION_FRAMES, type VideoProps } from '@/remotion/types'
import { Film, Loader2 } from 'lucide-react'

interface VideoPreviewProps {
  videoProps: VideoProps
  onRender: () => void
  isRendering: boolean
}

export function VideoPreview({ videoProps, onRender, isRendering }: VideoPreviewProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component = COMPOSITION_MAP[videoProps.postType] as React.ComponentType<any>

  // Generate a key that changes when important props change, forcing the Player to re-render
  const playerKey = useMemo(() => {
    return [
      videoProps.postType,
      videoProps.content,
      videoProps.animalName || '',
      videoProps.photoUrls.join(','),
      videoProps.logoUrl || '',
      videoProps.videoText || '',
      videoProps.musicUrl || '',
    ].join('|')
  }, [videoProps.postType, videoProps.content, videoProps.animalName, videoProps.photoUrls, videoProps.logoUrl, videoProps.videoText, videoProps.musicUrl])

  return (
    <div className="space-y-3">
      <div className="relative mx-auto" style={{ maxWidth: 400 }}>
        <div className="aspect-square rounded-xl overflow-hidden border border-border shadow-lg">
          <Player
            key={playerKey}
            component={Component}
            inputProps={videoProps as unknown as Record<string, unknown>}
            compositionWidth={VIDEO_WIDTH}
            compositionHeight={VIDEO_HEIGHT}
            fps={VIDEO_FPS}
            durationInFrames={VIDEO_DURATION_FRAMES}
            style={{ width: '100%', height: '100%' }}
            controls
            loop
            autoPlay={false}
            clickToPlay
          />
        </div>
      </div>

      <p className="text-xs text-muted text-center">
        La preview se met a jour en temps reel avec le contenu du formulaire
      </p>

      <div className="flex justify-center">
        <button
          onClick={onRender}
          disabled={isRendering || !videoProps.content}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white text-sm
            bg-primary hover:bg-primary-dark transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRendering ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Rendu en cours...
            </>
          ) : (
            <>
              <Film className="w-4 h-4" />
              Rendre la video
            </>
          )}
        </button>
      </div>
    </div>
  )
}
