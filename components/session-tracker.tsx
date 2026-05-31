'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import UserInfoModal from '@/components/dashboard/user-info-modal'

const HEARTBEAT_INTERVAL_MS = 60 * 1000

export default function SessionTracker() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const updateSession = async () => {
      try {
        await fetch('/api/session', { method: 'POST', cache: 'no-store' })
      } catch (error) {
        console.error('Failed to update session:', error)
      }
    }

    const stopHeartbeat = () => {
      // Cleanup handled by the effect
    }

    const startHeartbeat = () => {
      updateSession()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateSession()
      }
    }

    const loadCurrentSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) {
        setCurrentUserId(data.session.user.id)
        startHeartbeat()
      }
    }

    loadCurrentSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUserId(session.user.id)
        startHeartbeat()
      } else {
        setCurrentUserId(null)
      }
    })

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', updateSession)

    return () => {
      stopHeartbeat()
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', updateSession)
    }
  }, [supabase])

  return (
    <>
      {currentUserId && <UserInfoModal userId={currentUserId} />}
    </>
  )
}
