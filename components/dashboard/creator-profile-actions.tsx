'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, UserMinus, Send, Loader2, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface CreatorProfileActionsProps {
  creatorId: string
  currentUserId: string | undefined
}

export default function CreatorProfileActions({ creatorId, currentUserId }: CreatorProfileActionsProps) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    if (currentUserId) {
      checkSubscription()
    } else {
      setLoading(false)
    }
  }, [creatorId, currentUserId])

  const checkSubscription = async () => {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('follower_id', currentUserId)
      .eq('following_id', creatorId)
      .single()
    
    setIsSubscribed(!!data)
    setLoading(false)
  }

  const handleSubscribe = async () => {
    if (!currentUserId) return alert('Faz login para subscrever!')
    setActionLoading(true)

    if (isSubscribed) {
      await supabase
        .from('subscriptions')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', creatorId)
      setIsSubscribed(false)
    } else {
      await supabase
        .from('subscriptions')
        .insert({
          follower_id: currentUserId,
          following_id: creatorId
        })

      // Send notification to creator
      const { data: followerProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', currentUserId)
        .single()

      const followerName = followerProfile?.display_name || 'Um utilizador'

      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: creatorId,
          title: 'Novo Subscritor',
          message: `${followerName} subscreveu ao teu perfil!`,
          type: 'subscription'
        })
      })

      setIsSubscribed(true)
    }
    setActionLoading(false)
  }

  const handleMessage = () => {
    router.push(`/dashboard/messages?user=${creatorId}`)
  }

  if (loading) {
    return (
      <div className="w-full rounded-2xl border border-border bg-white/90 p-2 shadow-lg shadow-black/5 backdrop-blur sm:w-64 dark:border-gray-800 dark:bg-gray-950/90">
        <div className="h-10 w-full animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    )
  }

  return (
    <div className="flex w-full flex-wrap gap-2 rounded-2xl border border-border bg-white/95 p-2 shadow-xl shadow-black/10 backdrop-blur-md sm:w-auto sm:flex-nowrap sm:justify-end dark:border-gray-800 dark:bg-gray-950/90 dark:shadow-black/30">
      <button
        onClick={handleMessage}
        className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-accent/25 bg-white px-4 py-2.5 text-sm font-bold text-accent transition-all hover:border-accent/40 hover:bg-accent/5 active:scale-95 sm:min-h-10 sm:flex-none sm:px-5 dark:bg-gray-900 dark:hover:bg-accent/10"
      >
        <Send size={16} />
        Mensagem
      </button>

      {currentUserId !== creatorId && (
        <button
          onClick={handleSubscribe}
          disabled={actionLoading}
          className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-md transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-70 sm:min-h-10 sm:flex-none sm:px-5 ${
            isSubscribed
              ? 'border border-gray-200 bg-gray-100 text-gray-600 hover:border-red-100 hover:bg-red-50 hover:text-red-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-red-900/60 dark:hover:bg-red-950/30 dark:hover:text-red-300'
              : 'bg-accent text-white hover:bg-accent/90 shadow-accent/20'
          }`}
        >
          {actionLoading ? <Loader2 size={16} className="animate-spin" /> : isSubscribed ? <UserMinus size={16} /> : <UserPlus size={16} />}
          <span>{isSubscribed ? 'Subscrito' : 'Subscrever'}</span>
        </button>
      )}
    </div>
  )
}
