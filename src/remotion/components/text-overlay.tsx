import { interpolate, useCurrentFrame } from 'remotion'

interface TitleOverlayProps {
  text: string
  color: string
  startFrame?: number
}

export function TitleOverlay({ text, color, startFrame = 15 }: TitleOverlayProps) {
  const frame = useCurrentFrame()

  const opacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const translateY = interpolate(frame, [startFrame, startFrame + 15], [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const fadeOut = interpolate(frame, [260, 300], [1, 0], { extrapolateLeft: 'clamp' })

  if (!text) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 120,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: opacity * fadeOut,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          padding: '14px 40px',
          borderRadius: 16,
          background: color,
          boxShadow: `0 10px 40px ${color}66`,
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          {text}
        </span>
      </div>
    </div>
  )
}

interface ContentOverlayProps {
  text: string
  startFrame?: number
}

export function ContentOverlay({ text, startFrame = 120 }: ContentOverlayProps) {
  const frame = useCurrentFrame()

  const opacity = interpolate(frame, [startFrame, startFrame + 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const fadeOut = interpolate(frame, [260, 300], [1, 0], { extrapolateLeft: 'clamp' })

  // Truncate text to ~120 chars for the video
  const displayText = text.length > 120 ? text.slice(0, 117) + '...' : text

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 160,
        left: 60,
        right: 60,
        opacity: opacity * fadeOut,
      }}
    >
      <div
        style={{
          padding: '20px 28px',
          borderRadius: 16,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <p
          style={{
            color: '#f1f5f9',
            fontSize: 26,
            lineHeight: 1.4,
            fontWeight: 500,
            textAlign: 'center',
            margin: 0,
          }}
        >
          {displayText}
        </p>
      </div>
    </div>
  )
}

interface CtaOverlayProps {
  text: string
  subtext?: string
  color: string
  startFrame?: number
}

export function CtaOverlay({ text, subtext, color, startFrame = 200 }: CtaOverlayProps) {
  const frame = useCurrentFrame()

  const opacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const fadeOut = interpolate(frame, [260, 300], [1, 0], { extrapolateLeft: 'clamp' })

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 60,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        opacity: opacity * fadeOut,
      }}
    >
      <div
        style={{
          padding: '12px 32px',
          borderRadius: 50,
          background: color,
          boxShadow: `0 8px 30px ${color}55`,
        }}
      >
        <span style={{ color: 'white', fontSize: 22, fontWeight: 700 }}>
          {text}
        </span>
      </div>
      {subtext && (
        <span style={{ color: '#94a3b8', fontSize: 18, fontWeight: 500 }}>
          {subtext}
        </span>
      )}
    </div>
  )
}
