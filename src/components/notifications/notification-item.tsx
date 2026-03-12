'use client'

import { useRouter } from 'next/navigation'
import { markNotificationRead } from '@/lib/actions/notifications'
import type { Notification } from '@/lib/types/database'

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'a l\'instant'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `il y a ${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `il y a ${days}j`
}

interface NotificationItemProps {
  notification: Notification
  onRead: (id: string) => void
  onNavigate: () => void
}

export function NotificationItem({ notification, onRead, onNavigate }: Readonly<NotificationItemProps>) {
  const router = useRouter()
  const isUnread = !notification.read

  function handleClick() {
    // Navigate immediately — don't block on markNotificationRead
    if (notification.link) {
      router.push(notification.link)
      onNavigate()
    }

    if (isUnread) {
      onRead(notification.id)
      // Fire-and-forget: mark as read in the background
      markNotificationRead(notification.id).catch(() => {})
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors ${
        isUnread ? 'bg-primary/5' : ''
      } hover:bg-surface-hover`}
    >
      {/* Unread indicator dot */}
      <div className="flex-shrink-0 mt-1.5">
        {isUnread ? (
          <span className="block w-2 h-2 rounded-full bg-primary" />
        ) : (
          <span className="block w-2 h-2" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-tight ${isUnread ? 'font-semibold text-text' : 'text-text'}`}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-muted mt-0.5 truncate">
            {notification.body}
          </p>
        )}
        <p className="text-[11px] text-muted mt-1">
          {timeAgo(notification.created_at)}
        </p>
      </div>

      {/* Link indicator */}
      {notification.link && (
        <div className="flex-shrink-0 mt-1 text-muted">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </button>
  )
}
