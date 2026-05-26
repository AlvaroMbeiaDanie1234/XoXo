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
    if (!isSubscribed && creatorId !== currentUserId) {
      alert('Precisas de subscrever a este criador para enviar mensagens!')
      return
    }
    router.push(`/dashboard/messages?user=${creatorId}`)
  }

  if (loading) return <div className="h-10 w-32 bg-gray-100 animate-pulse rounded-full"></div>

  return (
    <div className="flex justify-end pt-4 gap-3">
      <button 
        onClick={handleMessage}
        className="px-6 py-2 rounded-full border border-accent text-accent font-semibold text-sm hover:bg-accent/5 transition-colors flex items-center gap-2"
      >
        <Send size={16} />
        Mensagem
      </button>
      
      {currentUserId !== creatorId && (
        <button 
          onClick={handleSubscribe}
          disabled={actionLoading}
          className={`px-6 py-2 rounded-full font-semibold text-sm transition-all flex items-center gap-2 shadow-md ${
            isSubscribed 
              ? 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 group' 
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
