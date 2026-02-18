'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { updateProfile } from '@/lib/actions/account'

interface AvatarUploadProps {
  userId: string
  currentAvatarUrl: string | null
  userEmail: string
}

export function AvatarUpload({ userId, currentAvatarUrl, userEmail }: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez selectionner une image')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('L\'image ne doit pas depasser 2 Mo')
      return
    }

    // Preview
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    // Upload
    startTransition(async () => {
      const ext = file.name.split('.').pop() || 'png'
      const path = `${userId}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (uploadError) {
        toast.error('Erreur lors de l\'upload : ' + uploadError.message)
        setPreview(currentAvatarUrl)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      const avatarUrl = `${publicUrl}?v=${Date.now()}`

      const result = await updateProfile({ avatar_url: avatarUrl })

      if (result.error) {
        toast.error(result.error)
        setPreview(currentAvatarUrl)
      } else {
        setPreview(avatarUrl)
        toast.success('Avatar mis a jour')
        router.refresh()
      }
    })
  }

  const initial = userEmail[0]?.toUpperCase() || '?'

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={isPending}
        className="relative group shrink-0"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Avatar"
            className="w-20 h-20 rounded-full object-cover border-2 border-border group-hover:border-primary transition-colors"
          />
        ) : (
          <div className="w-20 h-20 rounded-full border-2 border-dashed border-border group-hover:border-primary transition-colors flex items-center justify-center bg-surface-dark">
            <span className="text-2xl font-bold text-muted">
              {initial}
            </span>
          </div>
        )}
        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        {isPending && (
          <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="text-sm">
        <p className="font-medium">Avatar</p>
        <p className="text-xs text-muted">Cliquez pour modifier. Max 2 Mo.</p>
      </div>
    </div>
  )
}
