import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'

interface BackgroundProps {
  gradient: [string, string]
}

export function Background({ gradient }: BackgroundProps) {
  const frame = useCurrentFrame()

  const rotation = interpolate(frame, [0, 300], [0, 360])

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${rotation}deg, ${gradient[0]}22, ${gradient[1]}44, #0f172a)`,
      }}
    />
  )
}
