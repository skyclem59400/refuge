'use client'

import { useState } from 'react'

interface MemberAvatarProps {
  src: string | null | undefined
  name: string
  size?: number
}

export function MemberAvatar({ src, name, size = 32 }: MemberAvatarProps) {
  const [hasError, setHasError] = useState(false)
  const initial = (name || '?')[0].toUpperCase()

  if (!src || hasError) {
    return (
      <div
        className="rounded-full gradient-primary flex items-center justify-center font-bold text-white shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.375 }}
      >
        {initial}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
      onError={() => setHasError(true)}
    />
  )
}
