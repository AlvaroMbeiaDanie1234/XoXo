'use client'

import { useEffect, useState } from 'react'
import { Trophy, Crown, Medal, TrendingUp, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Creator {
  id: string
  display_name: string
  avatar_url: string | null
  is_verified: boolean
  subscriber_count: number
}

export default function TopCreatorsRanking() {
  const [topCreators, setTopCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchTopCreators() {
      try {
        // Fetch profiles with limit
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, is_verified')
          .limit(100)

        if (error) throw error

        // Single query for all subscriber counts
        const { data: allSubs } = await supabase
          .from('subscriptions')
          .select('following_id')

        const countMap: Record<string, number> = {}
        if (allSubs) {
          allSubs.forEach(sub => {
            countMap[sub.following_id] = (countMap[sub.following_id] || 0) + 1
          })
        }

        const creatorsWithCounts = (profiles || []).map(creator => ({
          ...creator,
          subscriber_count: countMap[creator.id] || 0
        }))

        // Sort by subscriber count and get top 3
        const sorted = creatorsWithCounts.sort((a, b) => b.subscriber_count - a.subscriber_count)
        setTopCreators(sorted.slice(0, 3))
      } catch (err) {
        console.error('Error fetching top creators:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTopCreators()
  }, [supabase])

  if (loading) {
    return (
      <div className={`p-4 rounded-xl border transition-colors duration-300 bg-gray-50 border-gray-200`}>
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="text-accent" size={18} />
          <h3 className="font-bold text-gray-900">Top Criadores</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg animate-pulse">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="text-yellow-500" size={24} />
      case 2:
        return <Medal className="text-gray-400" size={20} />
      case 3:
        return <Medal className="text-amber-600" size={20} />
      default:
        return <Star className="text-gray-400" size={16} />
    }
  }

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white'
      case 2:
        return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white'
      case 3:
        return 'bg-gradient-to-r from-amber-500 to-amber-700 text-white'
      default:
        return 'bg-gray-200 text-gray-600'
    }
  }

  return (
    <div className={`p-4 rounded-xl border transition-colors duration-300 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 border-purple-200 shadow-lg`}>
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="text-purple-600" size={18} />
        <h3 className="font-bold text-gray-900">Placar FAMA XOXO</h3>
        <TrendingUp className="text-accent ml-auto" size={16} />
      </div>

      <div className="space-y-3">
        {topCreators.map((creator, index) => (
          <div
            key={creator.id}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:scale-105 ${
              index === 0 ? 'bg-gradient-to-r from-yellow-100 to-yellow-200 shadow-md border-2 border-yellow-400' :
              index === 1 ? 'bg-gradient-to-r from-gray-100 to-gray-200 shadow-sm border border-gray-300' :
              'bg-gradient-to-r from-amber-100 to-amber-200 shadow-sm border border-amber-300'
            }`}
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-sm">
              {getRankIcon(index + 1)}
            </div>

            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white font-bold text-sm uppercase shadow-sm flex-shrink-0 overflow-hidden">
              {creator.avatar_url ? (
                <img
                  src={creator.avatar_url}
                  alt={creator.display_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                creator.display_name?.charAt(0) || '?'
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-gray-900 truncate text-sm">{creator.display_name || 'Sem Nome'}</span>
                {creator.is_verified && <Star size={12} className="text-blue-500 fill-blue-500 flex-shrink-0" />}
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <span className="font-semibold">{creator.subscriber_count.toLocaleString()}</span>
                <span>seguidores</span>
              </div>
            </div>

            <div className={`px-2 py-1 rounded-full text-xs font-bold ${getRankBadge(index + 1)}`}>
              #{index + 1}
            </div>
          </div>
        ))}

        {topCreators.length === 0 && (
          <div className="text-center py-6 text-gray-500 text-sm">
            Ainda não há criadores no ranking
          </div>
        )}
      </div>
    </div>
  )
}
