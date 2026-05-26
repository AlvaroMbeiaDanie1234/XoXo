'use client'

import Sidebar from '@/components/dashboard/sidebar'
import PostCard from '@/components/dashboard/post-card'
import { Search, UserPlus, Check, TrendingUp, Star, Sparkles, Video, Image as ImageIcon, FileText, Heart, MessageCircle, Share2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useRef } from 'react'
import { useTheme } from 'next-themes'
import Link from 'next/link'

export default function ExplorePage() {
  const [user, setUser] = useState<any>(null)
  const [creators, setCreators] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())
  const [followersCount, setFollowersCount] = useState<Record<string, number>>({})
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const supabase = createClient()
  const searchRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    async function loadData() {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)

      // Fetch all creators (profiles)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', currentUser?.id || '')
        .limit(20)

      if (profiles) {
        setCreators(profiles)

        // Fetch followers count for each creator
        const followersPromises = profiles.map(async (profile) => {
          const { count } = await supabase
            .from('subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', profile.id)
          return { id: profile.id, count: count || 0 }
        })

        const followersData = await Promise.all(followersPromises)
        const followersMap: Record<string, number> = {}
        followersData.forEach(({ id, count }) => {
          followersMap[id] = count
        })
        setFollowersCount(followersMap)
      }

      // Fetch posts with real likes count
      const { data: postsData } = await supabase
        .from('posts')
        .select('*, profiles!inner(display_name, avatar_url, is_verified), likes(count)')
        .order('created_at', { ascending: false })
        .limit(10)

      if (postsData) {
        setPosts(postsData)
      }

      // Fetch current user's subscriptions
      if (currentUser) {
        const [subsRes, likesRes] = await Promise.all([
          supabase.from('subscriptions').select('following_id').eq('follower_id', currentUser.id),
          supabase.from('likes').select('post_id').eq('user_id', currentUser.id)
        ])

        const followingSet = new Set(subsRes.data?.map(s => s.following_id) || [])
        const likedSet = new Set(likesRes.data?.map(l => l.post_id) || [])
        setFollowing(followingSet)
        setLikedPosts(likedSet)
      }

      // Fetch online users (profiles with last_online within last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data: onlineProfiles } = await supabase
        .from('profiles')
        .select('id')
        .gte('last_online', fiveMinutesAgo)

      if (onlineProfiles) {
        setOnlineUsers(new Set(onlineProfiles.map(p => p.id)))
      }

      setLoading(false)
    }

    loadData()
  }, [supabase])

  const filteredCreators = creators.filter(creator =>
    creator.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    creator.username?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const suggestions = searchQuery.length > 0
    ? creators.filter(creator =>
        creator.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        creator.username?.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : []

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleFollow = async (creatorId: string) => {
    if (!user) return

    if (following.has(creatorId)) {
      await supabase.from('subscriptions').delete().eq('follower_id', user.id).eq('following_id', creatorId)
      setFollowing(prev => {
        const newSet = new Set(prev)
        newSet.delete(creatorId)
        return newSet
      })
    } else {
      await supabase.from('subscriptions').insert({ follower_id: user.id, following_id: creatorId })
      setFollowing(prev => new Set(prev).add(creatorId))
    }
  }

  const handleLike = async (postId: string) => {
    if (!user) return

    if (likedPosts.has(postId)) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id)
      setLikedPosts(prev => {
        const newSet = new Set(prev)
        newSet.delete(postId)
        return newSet
      })
    } else {
      await supabase.from('likes').insert({ post_id: postId, user_id: user.id })
      setLikedPosts(prev => new Set(prev).add(postId))
    }
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900' : 'bg-background'}`}>
      {/* Global Top Navbar */}
      <div className={`sticky top-0 z-50 border-b shadow-sm transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-border'}`}>
        <div className="max-w-[1128px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-accent lg:hidden">XoXo</h2>
            <div ref={searchRef} className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md border w-64 transition-all focus-within:w-80 relative ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-[#f3f2ef] border-border'}`}>
              <Search size={16} className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} />
              <input
                type="text"
                placeholder="Pesquisar..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                className={`w-full bg-transparent text-sm outline-none ${theme === 'dark' ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'}`}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className={`absolute top-full left-0 right-0 mt-2 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-border'}`}>
                  {suggestions.map((creator) => (
                    <button
                      key={creator.id}
                      onClick={() => {
                        setSearchQuery(creator.display_name || creator.username || '')
                        setShowSuggestions(false)
                      }}
                      className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
                        {creator.avatar_url ? (
                          <img src={creator.avatar_url} alt={creator.display_name} className="w-full h-full object-cover" />
                        ) : (
                          creator.display_name?.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{creator.display_name || 'Sem nome'}</p>
                        {creator.username && (
                          <p className={`text-xs truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>@{creator.username}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className={`text-xs font-medium ${theme === 'dark' ? 'text-white' : 'text-foreground'}`}>{user.email}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white font-bold text-xs">
                {user.email?.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar + Main Content */}
      <div className="max-w-[1128px] mx-auto flex justify-center gap-6 pt-6 px-4">
        {/* Left Sidebar */}
        <div className="hidden lg:block w-[225px] flex-shrink-0">
          <Sidebar />
        </div>

        {/* Main Content */}
        <div className="flex-1 max-w-2xl w-full">
          {/* Stories Section */}
          <div className={`mb-6 p-4 rounded-xl border transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-border'}`}>
            <h3 className={`font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-foreground'}`}>
              <Sparkles size={18} className="text-accent" />
              Criadores em Destaque
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {creators.slice(0, 8).map((creator) => (
                <div key={creator.id} className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-accent to-primary p-[2px] group-hover:scale-110 transition-transform">
                    <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-muted flex items-center justify-center text-white font-bold">
                      {creator.avatar_url ? (
                        <img src={creator.avatar_url} alt={creator.display_name} className="w-full h-full object-cover" />
                      ) : (
                        creator.display_name?.charAt(0).toUpperCase()
                      )}
                    </div>
                  </div>
                  <span className={`text-xs truncate w-16 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{creator.display_name?.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trending Section */}
          <div className={`mb-6 p-4 rounded-xl border transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-border'}`}>
            <h3 className={`font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-foreground'}`}>
              <TrendingUp size={18} className="text-accent" />
              Em Alta
            </h3>
            <div className="space-y-4">
              {posts.slice(0, 3).map((post) => (
                <Link key={post.id} href={`/dashboard/post/${post.id}`} className={`block p-3 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
                      {post.profiles?.avatar_url ? (
                        <img src={post.profiles.avatar_url} alt={post.profiles.display_name} className="w-full h-full object-cover" />
                      ) : (
                        post.profiles?.display_name?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{post.title}</p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{post.profiles?.display_name}</p>
                    </div>
                    <div className={`flex items-center gap-1 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      <Heart size={14} />
                      <span>12</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Feed Section */}
          <div className="space-y-4">
            <h3 className={`font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-foreground'}`}>
              <Star size={18} className="text-accent" />
              Feed Recente
            </h3>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
              </div>
            ) : posts.length === 0 ? (
              <div className={`p-8 rounded-xl border text-center ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-border'}`}>
                <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Nenhum conteúdo disponível no momento.</p>
              </div>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  {...post}
                  creator_name={post.profiles?.display_name || 'Usuário'}
                  creator_avatar={post.profiles?.avatar_url || undefined}
                  creator_verified={post.profiles?.is_verified || false}
                  creator_id={post.user_id}
                  likes={post.likes?.[0]?.count || 0}
                />
              ))
            )}
          </div>

          {/* Suggested Creators Section */}
          <div className={`mt-6 p-4 rounded-xl border transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-border'}`}>
            <h3 className={`font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-foreground'}`}>
              <UserPlus size={18} className="text-accent" />
              Criadores Sugeridos
            </h3>
            <div className="space-y-3">
              {creators.slice(0, 5).map((creator) => (
                <div key={creator.id} className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
                      {creator.avatar_url ? (
                        <img src={creator.avatar_url} alt={creator.display_name} className="w-full h-full object-cover" />
                      ) : (
                        creator.display_name?.charAt(0).toUpperCase()
                      )}
                    </div>
                    {onlineUsers.has(creator.id) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{creator.display_name || 'Sem nome'}</p>
                    <div className="flex items-center gap-2">
                      {creator.username && (
                        <p className={`text-xs truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>@{creator.username}</p>
                      )}
                      <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        {followersCount[creator.id] || 0} seguidores
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleFollow(creator.id)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      following.has(creator.id)
                        ? `${theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
                        : 'bg-accent text-white hover:bg-accent/90'
                    }`}
                  >
                    {following.has(creator.id) ? 'Seguindo' : 'Seguir'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
