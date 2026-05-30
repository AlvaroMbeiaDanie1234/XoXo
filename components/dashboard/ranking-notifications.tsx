'use client'

import { useEffect, useState } from 'react'
import { Trophy, TrendingUp, TrendingDown, Crown, X, Check } from 'lucide-react'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'

export default function RankingNotifications() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [show, setShow] = useState(false)
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('ranking_notifications')
          .select('*')
          .eq('user_id', user.id)
          .eq('read', false)
          .order('created_at', { ascending: false })
          .limit(5)

        if (error) throw error

        if (data && data.length > 0) {
          setNotifications(data)
          setShow(true)
        }
      } catch (err) {
        console.error('Error fetching ranking notifications:', err)
      }
    }

    fetchNotifications()

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)

    return () => clearInterval(interval)
  }, [supabase])

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase.from('ranking_notifications').update({ read: true }).eq('id', notificationId)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from('ranking_notifications').update({ read: true }).eq('user_id', user.id)
      setNotifications([])
      setShow(false)
    } catch (err) {
      console.error('Error marking all notifications as read:', err)
    }
  }

  if (!show || notifications.length === 0) return null

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'top_1':
        return <Crown className="text-yellow-500" size={20} />
      case 'rank_up':
        return <TrendingUp className="text-green-500" size={20} />
      case 'rank_down':
        return <TrendingDown className="text-red-500" size={20} />
      default:
        return <Trophy className="text-accent" size={20} />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'top_1':
        return 'bg-gradient-to-r from-yellow-100 to-yellow-200 border-yellow-400'
      case 'rank_up':
        return 'bg-gradient-to-r from-green-100 to-green-200 border-green-400'
      case 'rank_down':
        return 'bg-gradient-to-r from-red-100 to-red-200 border-red-400'
      default:
        return 'bg-gradient-to-r from-purple-100 to-purple-200 border-purple-400'
    }
  }

  return (
    <div className="fixed top-4 right-4 z-[9999] w-96 max-w-[calc(100vw-2rem)]">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="text-white" size={20} />
            <h3 className="text-white font-bold">Placar FAMA XOXO</h3>
          </div>
          <button
            onClick={() => setShow(false)}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 rounded-xl border-2 ${getNotificationColor(notification.type)} transition-all duration-300 hover:scale-105`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{notification.message}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {formatRelativeTime(notification.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => markAsRead(notification.id)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Check size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <button
            onClick={markAllAsRead}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-2 rounded-xl hover:opacity-90 transition-opacity"
          >
            Marcar todas como lidas
          </button>
        </div>
      </div>
    </div>
  )
}
