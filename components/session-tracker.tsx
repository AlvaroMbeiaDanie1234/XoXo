'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const HEARTBEAT_INTERVAL_MS = 60 * 1000

export default function SessionTracker() {
  useEffect(() => {
    const supabase = createClient()
    let interval: ReturnType<typeof setInterval> | null = null
    let stopped = false

    const updateSession = async () => {
      try {
        await fetch('/api/session', { method: 'POST', cache: 'no-store' })
      } catch (error) {
        console.error('Failed to update session:', error)
      }
    }

    const stopHeartbeat = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    const startHeartbeat = () => {
      updateSession()

      if (!interval) {
        interval = setInterval(updateSession, HEARTBEAT_INTERVAL_MS)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateSession()
      }
    }

    const loadCurrentSession = async () => {
      const { data } = await supabase.auth.getSession()

      if (!stopped && data.session) {
        startHeartbeat()
      }
    }

    loadCurrentSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        startHeartbeat()
      } else {
        stopHeartbeat()
      }
    })

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', updateSession)

    return () => {
      stopped = true
      stopHeartbeat()
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', updateSession)
    }
  }, [])

  return null
}
