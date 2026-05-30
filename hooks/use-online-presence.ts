'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const CHANNEL_NAME = 'online-users'

export function useOnlinePresence(userId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    // Remove canais antigos com o mesmo nome
    supabase.getChannels().forEach((channel) => {
      if (channel.topic === `realtime:${CHANNEL_NAME}`) {
        supabase.removeChannel(channel)
      }
    })

    const channel = supabase.channel(CHANNEL_NAME, {
      config: {
        presence: {
          key: userId,
        },
      },
    })

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const ids = new Set<string>(Object.keys(state))
      setOnlineUsers(ids)
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          })
        } catch (error) {
          console.error('Erro ao registrar presença:', error)
        }
      }
    })

    return () => {
      try {
        channel.untrack()
      } catch (error) {
        console.error('Erro ao remover presença:', error)
      }

      supabase.removeChannel(channel)
    }
  }, [userId])

  const isOnline = (id: string) => onlineUsers.has(id)

  return {
    onlineUsers,
    isOnline,
  }
}