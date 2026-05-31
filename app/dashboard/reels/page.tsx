'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Heart, MessageCircle, MoreHorizontal, Play, Pause, ChevronUp, ChevronDown, X, Send, Lock } from 'lucide-react'
import { formatRelativeTime } from '@/lib/format-relative-time'
import Header from '@/components/dashboard/header'
import Sidebar from '@/components/dashboard/sidebar'
import { useRouter } from 'next/navigation'

export default function ReelsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const VIDEOS_PER_PAGE = 3
  const PAID_PREVIEW_SECONDS = 1
  const [paidVideos, setPaidVideos] = useState<Set<string>>(new Set())
  const [previewExpired, setPreviewExpired] = useState<Set<string>>(new Set())
  const [videoDurations, setVideoDurations] = useState<Record<string, number>>({})

  // Comments state
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [commentInput, setCommentInput] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const videoTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pageCacheRef = useRef<Record<number, any[]>>({})
  const isLockedVideo = (video: any) =>
    Boolean(video && !video.is_free && Number(video.price) > 0 && !paidVideos.has(video.id))
  const clearVideoTimer = (videoId?: string) => {
    if (!videoId) return
    const timer = videoTimersRef.current[videoId]
    if (!timer) return
    clearTimeout(timer)
    delete videoTimersRef.current[videoId]
  }
  const formatDuration = (seconds?: number) => {
    if (!seconds || Number.isNaN(seconds)) return null
    const total = Math.floor(seconds)
    const minutes = Math.floor(total / 60)
    const secs = String(total % 60).padStart(2, '0')
    return `${minutes}:${secs}`
  }

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        // Load paid videos
        const { data: payments } = await supabase
          .from('purchases')
          .select('post_id')
          .eq('user_id', user.id)
          .eq('status', 'completed')

        const paidSet = new Set(payments?.map(p => p.post_id) || [])
        setPaidVideos(paidSet)
      }
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
          const videoData = videos[index]

          if (entry.isIntersecting) {
            if (video) {
              if (isLockedVideo(videoData)) {
                video.play().catch(console.error)
                clearVideoTimer(videoData.id)
                const timer = setTimeout(() => {
                  video.pause()
                  video.currentTime = 0
                  setPreviewExpired(prev => new Set(prev).add(videoData.id))
                }, PAID_PREVIEW_SECONDS * 1000)
                videoTimersRef.current[videoData.id] = timer
              } else {
                video.play().catch(console.error)
              }
            }
          } else {
            if (video) {
              video.pause()
              clearVideoTimer(videoData?.id)
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
      Object.keys(videoTimersRef.current).forEach(clearVideoTimer)
    }
  }, [videos, paidVideos])

  useEffect(() => {
    // Auto-play current video in modal
    if (videoRef.current && selectedVideoIndex !== null && videos[selectedVideoIndex]) {
      const videoData = videos[selectedVideoIndex]

      // Check if video is paid and user hasn't paid
      if (isLockedVideo(videoData)) {
        setIsPlaying(false)
      } else {
        videoRef.current.play().catch(console.error)
        setIsPlaying(true)
      }
    }

    return () => {}
  }, [selectedVideoIndex, videos, paidVideos])

  const loadVideos = async () => {
    try {
      if (pageCacheRef.current[0]) {
        const cached = pageCacheRef.current[0]
        setVideos(cached)
        setHasMore(cached.length >= VIDEOS_PER_PAGE)
        setPage(1)
        return
      }

      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(display_name, avatar_url, is_verified)')
        .eq('content_type', 'video')
        .order('created_at', { ascending: false })
        .range(0, VIDEOS_PER_PAGE - 1)

      if (error) throw error
      const firstPage = data || []
      pageCacheRef.current[0] = firstPage
      setVideos(firstPage)
      setHasMore(firstPage.length >= VIDEOS_PER_PAGE)
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

      if (pageCacheRef.current[page]) {
        const cachedPage = pageCacheRef.current[page]
        if (cachedPage.length > 0) {
          setVideos(prev => {
            const existing = new Set(prev.map(v => v.id))
            const merged = [...prev]
            cachedPage.forEach(item => {
              if (!existing.has(item.id)) merged.push(item)
            })
            return merged
          })
          setPage(prev => prev + 1)
          setHasMore(cachedPage.length >= VIDEOS_PER_PAGE)
          return
        }
        setHasMore(false)
        return
      }
      
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(display_name, avatar_url, is_verified)')
        .eq('content_type', 'video')
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error
      
      if (data && data.length > 0) {
        pageCacheRef.current[page] = data
        setVideos(prev => [...prev, ...data])
        setPage(prev => prev + 1)
        setHasMore(data.length >= VIDEOS_PER_PAGE)
      } else {
        pageCacheRef.current[page] = []
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
      const activeVideo = selectedVideoIndex !== null ? videos[selectedVideoIndex] : null
      if (isLockedVideo(activeVideo) && activeVideo) {
        return
      }
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
                      onLoadedMetadata={(e) => {
                        const duration = e.currentTarget.duration
                        if (!duration || Number.isNaN(duration)) return
                        setVideoDurations(prev =>
                          prev[video.id] === duration ? prev : { ...prev, [video.id]: duration }
                        )
                      }}
                    />
                    
                    {/* Play Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <Play size={48} className="text-white" />
                    </div>

                    {isLockedVideo(video) && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-black/85 transition-colors">
                        <Lock size={28} className="text-white mb-2" />
                        <p className="text-white text-xs font-semibold text-center">Conteúdo pago. Paga para continuar.</p>
                      </div>
                    )}

                    {paidVideos.has(video.id) && (
                      <div className="absolute top-2 right-2 z-10 px-2 py-1 rounded-full bg-green-600/90 text-white text-[10px] font-bold uppercase tracking-wide">
                        Pago
                      </div>
                    )}

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
                          {formatDuration(videoDurations[video.id]) && (
                            <p className="text-white/80 text-[10px] font-semibold">
                              Duração: {formatDuration(videoDurations[video.id])}
                            </p>
                          )}
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
              onLoadedMetadata={(e) => {
                const duration = e.currentTarget.duration
                if (!duration || Number.isNaN(duration)) return
                setVideoDurations(prev =>
                  prev[currentVideo.id] === duration ? prev : { ...prev, [currentVideo.id]: duration }
                )
              }}
            />
            
            {/* Play/Pause Overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              {isPlaying ? (
                <Pause size={64} className="text-white" />
              ) : (
                <Play size={64} className="text-white" />
              )}
            </div>

            {paidVideos.has(currentVideo.id) && (
              <div className="absolute top-4 left-4 z-20 px-3 py-1 rounded-full bg-green-600/90 text-white text-xs font-bold uppercase tracking-wide">
                Pago
              </div>
            )}

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
                  {formatDuration(videoDurations[currentVideo.id]) && (
                    <p className="text-white/80 text-xs font-semibold">
                      Duração: {formatDuration(videoDurations[currentVideo.id])}
                    </p>
                  )}
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
                <div className="mt-4 rounded-2xl border border-white/15 bg-black/60 backdrop-blur-md overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <p className="text-white font-semibold text-sm">Comentários</p>
                    <span className="text-white/60 text-xs">{comments.length}</span>
                  </div>

                  <div className="max-h-64 overflow-y-auto px-3 py-3 space-y-2">
                    {comments.length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-white/70 text-sm font-medium">Seja o primeiro a comentar</p>
                        <p className="text-white/40 text-xs mt-1">Partilha a tua opinião sobre este reel.</p>
                      </div>
                    ) : (
                      comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="flex gap-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors p-2.5"
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-primary p-[2px] flex-shrink-0">
                            <div className="w-full h-full rounded-full border border-white/40 overflow-hidden bg-muted flex items-center justify-center">
                              {comment.profiles?.avatar_url ? (
                                <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-white text-xs font-bold">
                                  {comment.profiles?.display_name?.charAt(0) || 'U'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <p className="text-white font-semibold text-xs truncate">
                                {comment.profiles?.display_name || 'Utilizador'}
                              </p>
                              <span className="text-white/40 text-[10px] whitespace-nowrap">
                                {formatRelativeTime(comment.created_at)}
                              </span>
                            </div>
                            <p className="text-white/90 text-sm leading-relaxed break-words">{comment.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {/* Comment Input */}
                  <div className="p-3 border-t border-white/10 bg-black/30">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder="Escreve um comentário..."
                        className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2.5 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-accent/70"
                      />
                      <button
                        onClick={() => handleSubmitComment(currentVideo.id)}
                        disabled={!commentInput.trim()}
                        className="px-3 bg-accent rounded-full text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {isLockedVideo(currentVideo) && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-20">
                <Lock size={34} className="text-white mb-3" />
                <p className="text-white font-bold text-center mb-2">Conteúdo pago. Paga para aceder.</p>
                {formatDuration(videoDurations[currentVideo.id]) && (
                  <p className="text-white text-xs font-semibold mb-4">
                    Duração do conteúdo: {formatDuration(videoDurations[currentVideo.id])}
                  </p>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/dashboard/post/${currentVideo.id}`)
                  }}
                  className="bg-accent hover:bg-accent/90 text-white px-5 py-2.5 rounded-lg font-semibold"
                >
                  Pagar para desbloquear
                </button>
              </div>
            )}
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
