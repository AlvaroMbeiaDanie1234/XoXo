'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/dashboard/sidebar'
import PostCard from '@/components/dashboard/post-card'
import { useRouter } from 'next/navigation'

interface Post {
  id: string
  title: string
  description: string
  content_type: string
  content_url: string
  thumbnail_url: string
  created_at: string
  user_id: string
  price?: number
  is_free?: boolean
  profiles?: {
    display_name: string
    avatar_url: string | null
    is_verified?: boolean
  }
}

const PURCHASED_INDEX_CACHE_KEY_PREFIX = 'xoxo:purchased:index:'
const PURCHASED_POSTS_CACHE_KEY_PREFIX = 'xoxo:purchased:posts:'
const PURCHASED_CACHE_TTL_MS = 2 * 60 * 1000

type PurchasedIndexCache = {
  timestamp: number
  postIds: string[]
}

type PurchasedPostsCache = {
  timestamp: number
  posts: Post[]
}

export default function FavoritesPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    let alive = true

    const readCache = <T,>(key: string): T | null => {
      if (typeof window === 'undefined') return null
      try {
        const raw = window.sessionStorage.getItem(key)
        return raw ? (JSON.parse(raw) as T) : null
      } catch {
        return null
      }
    }

    const writeCache = (key: string, value: unknown) => {
      if (typeof window === 'undefined') return
      try {
        window.sessionStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Ignore cache quota/storage errors.
      }
    }

    const isFresh = (timestamp: number) => Date.now() - timestamp < PURCHASED_CACHE_TTL_MS

    const fetchFavorites = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser()

        if (!currentUser) {
          router.push('/auth/login')
          return
        }

        if (!alive) return
        setUser(currentUser)

        const indexCacheKey = `${PURCHASED_INDEX_CACHE_KEY_PREFIX}${currentUser.id}`
        const postsCacheKey = `${PURCHASED_POSTS_CACHE_KEY_PREFIX}${currentUser.id}`

        // Fast path: hydrate UI from cache first for instant rendering.
        const cachedPosts = readCache<PurchasedPostsCache>(postsCacheKey)
        if (cachedPosts?.posts?.length) {
          setPosts(cachedPosts.posts)
          setLoading(false)
        }

        // Fetch purchased post ids first
        const { data, error } = await supabase
          .from('purchases')
          .select('post_id, created_at')
          .eq('user_id', currentUser.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })

        if (error) throw error

        const postIds = Array.from(new Set((data || []).map((item: any) => item.post_id).filter(Boolean)))
        const previousIndexCache = readCache<PurchasedIndexCache>(indexCacheKey)

        if (postIds.length === 0) {
          writeCache(postsCacheKey, {
            timestamp: Date.now(),
            posts: [],
          } satisfies PurchasedPostsCache)
          setPosts([])
          return
        }

        // Reuse cached posts when index did not change and cache is still fresh.
        if (
          cachedPosts &&
          previousIndexCache &&
          isFresh(cachedPosts.timestamp) &&
          previousIndexCache.postIds.length === postIds.length &&
          previousIndexCache.postIds.every((id, idx) => id === postIds[idx])
        ) {
          setPosts(cachedPosts.posts)
          writeCache(indexCacheKey, {
            timestamp: Date.now(),
            postIds,
          } satisfies PurchasedIndexCache)
          return
        }

        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('*, profiles(display_name, avatar_url, is_verified)')
          .in('id', postIds)

        if (postsError) throw postsError

        const postMap = new Map((postsData || []).map((post: any) => [post.id, post]))
        const orderedPosts = postIds
          .map((postId) => postMap.get(postId))
          .filter(Boolean) as Post[]

        writeCache(postsCacheKey, {
          timestamp: Date.now(),
          posts: orderedPosts,
        } satisfies PurchasedPostsCache)
        writeCache(indexCacheKey, {
          timestamp: Date.now(),
          postIds,
        } satisfies PurchasedIndexCache)

        if (!alive) return
        setPosts(orderedPosts)
      } catch (err) {
        console.error('Error fetching purchased posts:', err)
      } finally {
        if (alive) setLoading(false)
      }
    }

    fetchFavorites()
    return () => {
      alive = false
    }
  }, [router])

  return (
    <div className="min-h-screen bg-background">
      {/* Global Top Navbar */}
      <div className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="max-w-[1128px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-accent lg:hidden">XoXo</h2>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-medium text-foreground">{user.email}</p>
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
          <div className="bg-white border border-border rounded-md p-6 shadow-sm mb-4">
            <h1 className="text-2xl font-bold text-foreground mb-1">Meus Comprados</h1>
            <p className="text-muted-foreground text-sm">
              {posts.length} {posts.length === 1 ? 'conteúdo' : 'conteúdos'} comprado{posts.length !== 1 ? 's' : ''}
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col gap-4 w-full">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-[400px] bg-gray-200 rounded-md animate-pulse border border-border"
                ></div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 bg-white border border-border rounded-md shadow-sm">
              <p className="text-muted-foreground text-lg">Você não tem conteúdos comprados ainda</p>
              <a href="/dashboard" className="text-accent hover:underline mt-4 inline-block font-medium">
                Explorar conteúdo
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-4 w-full">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  id={post.id}
                  title={post.title}
                  description={post.description}
                  thumbnail_url={post.thumbnail_url}
                  content_url={post.content_url}
                  content_type={post.content_type as 'video' | 'article' | 'photo'}
                  creator_name={post.profiles?.display_name || 'Usuário'}
                  creator_avatar={post.profiles?.avatar_url || undefined}
                  creator_verified={post.profiles?.is_verified || false}
                  creator_id={post.user_id}
                  price={post.price}
                  is_free={post.is_free}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
