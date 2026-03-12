'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getUnreadCount } from '@/lib/actions/notifications'
import { NotificationDropdown } from './notification-dropdown'

const POLL_INTERVAL = 30_000

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchCount = useCallback(async () => {
    try {
      const result = await getUnreadCount()
      if ('data' in result) setUnreadCount(result.data ?? 0)
    } catch {
      // Silently ignore polling errors
    }
  }, [])

  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchCount])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  function handleToggle() {
    setIsOpen((prev) => !prev)
  }

  function handleClose() {
    setIsOpen(false)
    fetchCount()
  }

  const displayCount = unreadCount > 9 ? '9+' : String(unreadCount)

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-lg text-muted hover:text-text hover:bg-surface-hover transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
            {displayCount}
          </span>
        )}
      </button>

      {isOpen && <NotificationDropdown onClose={handleClose} />}
    </div>
  )
}
