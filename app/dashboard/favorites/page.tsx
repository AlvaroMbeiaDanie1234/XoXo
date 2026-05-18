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
  profiles?: {
    display_name: string
    avatar_url: string | null
  }
}

export default function FavoritesPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser()

        if (!currentUser) {
          router.push('/auth/login')
          return
        }

        setUser(currentUser)

        // Fetch favorite posts
        const { data, error } = await supabase
          .from('favorites')
          .select('posts(*, profiles(display_name, avatar_url))')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })

        if (error) throw error

        const favoritePosts = data?.map((fav: any) => fav.posts).filter(Boolean) || []
        setPosts(favoritePosts)
      } catch (err) {
        console.error('Error fetching favorites:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchFavorites()
  }, [supabase, router])

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
            <h1 className="text-2xl font-bold text-foreground mb-1">Meus Favoritos</h1>
            <p className="text-muted-foreground text-sm">
              {posts.length} {posts.length === 1 ? 'conteúdo' : 'conteúdos'} favoritado{posts.length !== 1 ? 's' : ''}
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
              <p className="text-muted-foreground text-lg">Você não tem favoritos ainda</p>
              <a href="/dashboard" className="text-accent hover:underline mt-4 inline-block font-medium">
                Explorar conteúdo
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-4 w-full">
              {posts.map((post, index) => (
                <PostCard
                  key={post.id}
                  id={post.id}
                  title={post.title}
                  description={post.description}
                  thumbnail_url={post.thumbnail_url}
                  content_type={post.content_type as 'video' | 'article' | 'photo'}
                  creator_name={post.profiles?.display_name || 'Usuário'}
                  creator_avatar={post.profiles?.avatar_url || undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
