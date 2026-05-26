'use client'

import { useEffect } from 'react'

export default function SessionTracker() {
  useEffect(() => {
    const updateSession = async () => {
      try {
        await fetch('/api/session', { method: 'POST' })
      } catch (error) {
        console.error('Failed to update session:', error)
      }
    }

    // Update session immediately
    updateSession()

    // Update session every 2 minutes
    const interval = setInterval(updateSession, 2 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  return null
}
