'use client'

import { useState, useEffect } from 'react'
import { getNotifications, markAllRead } from '@/lib/actions/notifications'
import { NotificationItem } from './notification-item'
import type { Notification } from '@/lib/types/database'

interface NotificationDropdownProps {
  onClose: () => void
}

export function NotificationDropdown({ onClose }: Readonly<NotificationDropdownProps>) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const result = await getNotifications({ limit: 20 })
        if ('data' in result && result.data) setNotifications(result.data)
      } catch {
        // Silently ignore load errors
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const hasUnread = notifications.some((n) => !n.read)

  async function handleMarkAllRead() {
    try {
      await markAllRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() })))
    } catch {
      // Silently ignore errors
    }
  }

  function handleNotificationRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n))
    )
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-surface border border-border rounded-xl shadow-xl z-50 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text">Notifications</h3>
        {hasUnread && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-primary hover:text-primary-light transition-colors"
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted">
            Chargement...
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">
            Aucune notification
          </div>
        ) : (
          <div className="py-1">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={handleNotificationRead}
                onNavigate={onClose}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
