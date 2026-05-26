'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Heart, MessageCircle, MoreHorizontal, Play, Pause, ChevronUp, ChevronDown, X, Send } from 'lucide-react'
import Header from '@/components/dashboard/header'
import Sidebar from '@/components/dashboard/sidebar'

export default function ReelsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const VIDEOS_PER_PAGE = 3
  
  // Comments state
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [commentInput, setCommentInput] = useState('')
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    loadUser()
    loadVideos()
  }, [])

  useEffect(() => {
    // Setup intersection observer for auto-play in grid
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = parseInt(entry.target.getAttribute('data-index') || '0')
          const video = entry.target.querySelector('video') as HTMLVideoElement
          
          if (entry.isIntersecting) {
            if (video) {
              video.play().catch(console.error)
            }
          } else {
            if (video) {
              video.pause()
            }
          }
        })
      },
      { threshold: 0.5 }
    )

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [videos])

  useEffect(() => {
    // Auto-play current video in modal
    if (videoRef.current && selectedVideoIndex !== null && videos[selectedVideoIndex]) {
      videoRef.current.play().catch(console.error)
      setIsPlaying(true)
    }
  }, [selectedVideoIndex, videos])

  const loadVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(display_name, avatar_url)')
        .eq('content_type', 'video')
        .order('created_at', { ascending: false })
        .range(0, VIDEOS_PER_PAGE - 1)

      if (error) throw error
      setVideos(data || [])
      setHasMore((data?.length || 0) >= VIDEOS_PER_PAGE)
      setPage(1)
    } catch (error) {
      console.error('Error loading videos:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMoreVideos = async () => {
    if (!hasMore || loadingMore) return
    
    setLoadingMore(true)
    try {
      const from = page * VIDEOS_PER_PAGE
      const to = from + VIDEOS_PER_PAGE - 1
      
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(display_name, avatar_url)')
        .eq('content_type', 'video')
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error
      
      if (data && data.length > 0) {
        setVideos(prev => [...prev, ...data])
        setPage(prev => prev + 1)
        setHasMore(data.length >= VIDEOS_PER_PAGE)
      } else {
        setHasMore(false)
      }
    } catch (error) {
      console.error('Error loading more videos:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play()
        setIsPlaying(true)
      } else {
        videoRef.current.pause()
        setIsPlaying(false)
      }
    }
  }

  const goToNext = () => {
    if (selectedVideoIndex !== null && selectedVideoIndex < videos.length - 1) {
      if (videoRef.current) {
        videoRef.current.pause()
      }
      setSelectedVideoIndex(prev => (prev !== null ? prev + 1 : null))
    } else if (hasMore) {
      loadMoreVideos()
    }
  }

  const goToPrevious = () => {
    if (selectedVideoIndex !== null && selectedVideoIndex > 0) {
      if (videoRef.current) {
        videoRef.current.pause()
      }
      setSelectedVideoIndex(prev => (prev !== null ? prev - 1 : null))
    }
  }

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY > 0) {
      goToNext()
    } else {
      goToPrevious()
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    const touchStartY = e.touches[0].clientY
    
    const handleTouchMove = (moveEvent: TouchEvent) => {
      const touchEndY = moveEvent.touches[0].clientY
      const diff = touchStartY - touchEndY
      
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          goToNext()
        } else {
          goToPrevious()
        }
        document.removeEventListener('touchmove', handleTouchMove)
      }
    }
    
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', () => {
      document.removeEventListener('touchmove', handleTouchMove)
    }, { once: true })
  }

  const loadComments = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Fetch profiles separately
      const userIds = data?.map(c => c.user_id) || []
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds)
      
      const commentsWithProfiles = data?.map(comment => ({
        ...comment,
        profiles: profiles?.find(p => p.id === comment.user_id)
      })) || []
      
      setComments(commentsWithProfiles)
    } catch (error) {
      console.error('Error loading comments:', error)
    }
  }

  const handleSubmitComment = async (postId: string) => {
    if (!user || !commentInput.trim()) return

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: commentInput.trim()
        })

      if (error) throw error

      setCommentInput('')
      loadComments(postId)
    } catch (error) {
      console.error('Error submitting comment:', error)
    }
  }

  const handleCommentClick = (postId: string) => {
    setShowComments(!showComments)
    if (!showComments) {
      loadComments(postId)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header user={user} />
        <div className="max-w-7xl mx-auto pt-6 px-4 flex gap-6">
          <div className="hidden lg:block w-[225px] flex-shrink-0">
            <Sidebar />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const currentVideo = selectedVideoIndex !== null ? videos[selectedVideoIndex] : null

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />
      <div className="max-w-7xl mx-auto pt-6 px-4 flex gap-6">
        <div className="hidden lg:block w-[225px] flex-shrink-0">
          <Sidebar />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-6">Reels</h1>
          
          {videos.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>Nenhum vídeo encontrado</p>
            </div>
          ) : (
            <>
              {/* Grid Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map((video, index) => (
                  <div
                    key={video.id}
                    data-index={index}
                    ref={(el) => {
                      if (el && observerRef.current) {
                        observerRef.current.observe(el)
                      }
                    }}
                    className="relative bg-black rounded-xl overflow-hidden aspect-[9/16] group cursor-pointer"
                    onClick={() => setSelectedVideoIndex(index)}
                  >
                    <video
                      src={video.content_url}
                      poster={video.thumbnail_url}
                      className="w-full h-full object-cover"
                      loop
                      muted
                      playsInline
                    />
                    
                    {/* Play Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <Play size={48} className="text-white" />
                    </div>

                    {/* Video Info */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-primary p-[2px]">
                          <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-muted flex items-center justify-center">
                            {video.profiles?.avatar_url ? (
                              <img src={video.profiles.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-white text-xs font-bold">
                                {video.profiles?.display_name?.charAt(0) || 'U'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-white font-semibold text-sm">{video.profiles?.display_name}</p>
                          <p className="text-white/70 text-xs">{video.title}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="text-center mt-6">
                  <button
                    onClick={loadMoreVideos}
                    disabled={loadingMore}
                    className="bg-accent hover:bg-accent/90 text-white font-semibold px-6 py-2 rounded-lg disabled:opacity-50"
                  >
                    {loadingMore ? 'Carregando...' : 'Carregar mais'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Full Screen Modal */}
      {selectedVideoIndex !== null && currentVideo && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          {/* Close Button */}
          <button
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.pause()
              }
              setSelectedVideoIndex(null)
            }}
            className="absolute top-4 right-4 z-10 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30"
          >
            <X size={24} />
          </button>

          {/* Desktop Navigation Arrows - Right Side */}
          <div className="hidden md:flex flex-col items-center gap-4 absolute right-4 top-1/2 -translate-y-1/2 z-10">
            <button
              onClick={goToPrevious}
              disabled={selectedVideoIndex === 0}
              className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronUp size={32} />
            </button>
            <span className="text-white text-sm font-semibold">
              {selectedVideoIndex + 1} / {videos.length}
            </span>
            <button
              onClick={goToNext}
              disabled={selectedVideoIndex === videos.length - 1 && !hasMore}
              className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronDown size={32} />
            </button>
          </div>

          {/* Video Container */}
          <div
            className="relative bg-black aspect-[9/16] max-w-md w-full h-full md:h-auto cursor-pointer"
            onClick={togglePlay}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
          >
            <video
              ref={videoRef}
              src={currentVideo.content_url}
              poster={currentVideo.thumbnail_url}
              className="w-full h-full object-cover"
              loop
              muted
              playsInline
            />
            
            {/* Play/Pause Overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              {isPlaying ? (
                <Pause size={64} className="text-white" />
              ) : (
                <Play size={64} className="text-white" />
              )}
            </div>

            {/* Video Info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-accent to-primary p-[2px]">
                  <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-muted flex items-center justify-center">
                    {currentVideo.profiles?.avatar_url ? (
                      <img src={currentVideo.profiles.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-sm font-bold">
                        {currentVideo.profiles?.display_name?.charAt(0) || 'U'}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-white font-semibold">{currentVideo.profiles?.display_name}</p>
                  <p className="text-white/70 text-sm">{currentVideo.title}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-2 text-white hover:text-accent transition-colors">
                  <Heart size={24} />
                  <span className="text-sm">Adoro</span>
                </button>
                <button 
                  onClick={() => handleCommentClick(currentVideo.id)}
                  className="flex items-center gap-2 text-white hover:text-accent transition-colors"
                >
                  <MessageCircle size={24} />
                  <span className="text-sm">Comentar</span>
                </button>
              </div>

              {/* Comments Section */}
              {showComments && (
                <div className="mt-4 bg-black/50 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <div className="space-y-3">
                    {comments.length === 0 ? (
                      <p className="text-white/70 text-sm text-center">Seja o primeiro a comentar!</p>
                    ) : (
                      comments.map((comment) => (
                        <div key={comment.id} className="flex gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-primary p-[2px] flex-shrink-0">
                            <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-muted flex items-center justify-center">
                              {comment.profiles?.avatar_url ? (
                                <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-white text-xs font-bold">
                                  {comment.profiles?.display_name?.charAt(0) || 'U'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-semibold text-sm">{comment.profiles?.display_name}</p>
                            <p className="text-white/90 text-sm">{comment.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {/* Comment Input */}
                  <div className="mt-4 flex gap-2">
                    <input
                      type="text"
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Escreve um comentário..."
                      className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <button
                      onClick={() => handleSubmitComment(currentVideo.id)}
                      disabled={!commentInput.trim()}
                      className="p-2 bg-accent rounded-full text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Navigation Indicator */}
          <div className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm font-semibold">
            {selectedVideoIndex + 1} / {videos.length}
          </div>
        </div>
      )}
    </div>
  )
}
