import { Img, interpolate, useCurrentFrame } from 'remotion'

interface AnimalPhotoProps {
  url: string
  startFrame?: number
  endFrame?: number
}

export function AnimalPhoto({ url, startFrame = 45, endFrame = 200 }: AnimalPhotoProps) {
  const frame = useCurrentFrame()

  const opacity = interpolate(frame, [startFrame, startFrame + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const fadeOut = interpolate(frame, [endFrame - 15, endFrame], [1, 0.8], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const scale = interpolate(frame, [startFrame, endFrame], [1, 1.08], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 600,
        height: 600,
        borderRadius: 24,
        overflow: 'hidden',
        opacity: opacity * fadeOut,
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
      }}
    >
      <Img
        src={url}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale})`,
        }}
      />
    </div>
  )
}
