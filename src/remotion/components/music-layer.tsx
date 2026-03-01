import { Audio, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

interface MusicLayerProps {
  url: string
}

export function MusicLayer({ url }: MusicLayerProps) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const fadeInEnd = 15
  const fadeOutStart = durationInFrames - 30

  const volume = interpolate(
    frame,
    [0, fadeInEnd, fadeOutStart, durationInFrames],
    [0, 0.3, 0.3, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  return <Audio src={url} volume={volume} />
}
