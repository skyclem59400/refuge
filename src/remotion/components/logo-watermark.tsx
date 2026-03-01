import { Img, interpolate, useCurrentFrame } from 'remotion'

interface LogoWatermarkProps {
  name: string
  color: string
  logoUrl?: string
}

export function LogoWatermark({ name, color, logoUrl }: LogoWatermarkProps) {
  const frame = useCurrentFrame()

  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })
  const fadeOut = interpolate(frame, [260, 300], [1, 0], { extrapolateLeft: 'clamp' })

  return (
    <div
      style={{
        position: 'absolute',
        top: 40,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: opacity * fadeOut,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 28px',
          borderRadius: 50,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(10px)',
          border: `2px solid ${color}44`,
        }}
      >
        {logoUrl ? (
          <Img
            src={logoUrl}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              objectFit: 'cover',
              border: `2px solid ${color}66`,
            }}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${color}, ${color}88)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 800,
              color: 'white',
            }}
          >
            {name[0]?.toUpperCase() || 'R'}
          </div>
        )}
        <span
          style={{
            color: 'white',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          {name}
        </span>
      </div>
    </div>
  )
}
