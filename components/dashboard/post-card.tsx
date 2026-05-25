'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Bookmark, 
  MoreHorizontal, 
  CheckCircle2,
  Share2,
  MessageSquare,
  ThumbsUp,
  Play,
  Maximize2,
  Lock,
  Trash2,
  Loader2
} from 'lucide-react'
import CommentsModal from './comments-modal'

interface PostCardProps {
  id: string
  title: string
  description: string
  thumbnail_url?: string
  content_url?: string
  content_type: 'video' | 'article' | 'photo'
  creator_name: string
  creator_avatar?: string
  creator_verified?: boolean
  creator_id?: string
  price?: number
  is_free?: boolean
}

export default function PostCard({
  id,
  title,
  description,
  thumbnail_url,
  content_url,
  content_type,
  creator_name,
  creator_avatar,
  creator_verified,
  creator_id,
  price,
  is_free = true,
}: PostCardProps) {
  const [isLiked, setIsLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(0)
  const [commentsCount, setCommentsCount] = useState(0)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [creatorVerified, setCreatorVerified] = useState(creator_verified || false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showCardPaywall, setShowCardPaywall] = useState(false)
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleted, setIsDeleted] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isFreePlan, setIsFreePlan] = useState(false)
  const [hasPurchased, setHasPurchased] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (videoRef.current && !showCardPaywall) {
            if (entry.isIntersecting) {
              const playPromise = videoRef.current.play()
              if (playPromise !== undefined) {
                playPromise.catch(() => {})
              }
              setIsPlaying(true)
            } else {
              videoRef.current.pause()
              setIsPlaying(false)
            }
          }
        })
      },
      { threshold: 0.6 } // Play when 60% visible
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [showCardPaywall])

  useEffect(() => {
    async function fetchPostStats() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUser(user)

        const [likesRes, commsRes] = await Promise.all([
          supabase.from('likes').select('id', { count: 'exact', head: true }).eq('post_id', id),
          supabase.from('comments').select('id', { count: 'exact', head: true }).eq('post_id', id)
        ])
        
        if (!likesRes.error) setLikesCount(likesRes.count || 0)
        if (!commsRes.error) setCommentsCount(commsRes.count || 0)
        setCreatorVerified(false)

        if (user) {
          const [likeDataRes, profileRes] = await Promise.all([
            supabase.from('likes').select('id').eq('post_id', id).eq('user_id', user.id).maybeSingle(),
            supabase.from('profiles').select('is_free_plan').eq('id', user.id).maybeSingle()
          ])
          setIsLiked(!!likeDataRes.data)
          setIsFreePlan(!!profileRes.data?.is_free_plan)
          // Check if user has purchased this content
          const purchaseRes = await supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('post_id', id).eq('user_id', user.id)
          setHasPurchased((purchaseRes.count ?? 0) > 0)
        }
      } catch (err) {
        console.error('Error fetching post stats:', err)
      }
    }

    fetchPostStats()
  }, [id, creator_id, supabase])

  const handleTimeUpdate = () => {
    if (is_free === false && !isFreePlan && videoRef.current && videoRef.current.currentTime >= 5) {
      videoRef.current.pause()
      setIsPlaying(false)
      setShowCardPaywall(true)
    }
  }

  const handlePlayClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (showCardPaywall) return
    
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
        setIsPlaying(false)
      } else {
        const playPromise = videoRef.current.play()
        if (playPromise !== undefined) {
          playPromise
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false))
        }
      }
    }
  }

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!currentUser) return alert('Faz login para interagir!')
    const originalIsLiked = isLiked
    const originalLikes = likesCount
    setIsLiked(!isLiked)
    setLikesCount(prev => isLiked ? prev - 1 : prev + 1)
    try {
      if (originalIsLiked) {
        await supabase.from('likes').delete().eq('post_id', id).eq('user_id', currentUser.id)
      } else {
        await supabase.from('likes').insert({ post_id: id, user_id: currentUser.id })
      }
    } catch (err) {
      setIsLiked(originalIsLiked)
      setLikesCount(originalLikes)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowDeleteModal(true)
  }

  const confirmDeletePost = async () => {
    setIsDeleting(true)
    try {
      // Proactively delete likes, comments, and favorites of this post first to prevent foreign key constraint violations
      await Promise.all([
        supabase.from('likes').delete().eq('post_id', id),
        supabase.from('comments').delete().eq('post_id', id),
        supabase.from('favorites').delete().eq('post_id', id)
      ])

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id)

      if (error) throw error

      setIsDeleted(true)
      setShowDeleteModal(false)
    } catch (err: any) {
      console.error(err)
      alert(`Erro ao eliminar publicação: ${err.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  if (isDeleted) return null

  return (
    <div ref={containerRef} className="bg-white border border-border rounded-xl mb-6 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300 w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/creator/${creator_id}`} className="relative group">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-accent to-purple-500 p-[2px]">
              <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-muted flex items-center justify-center">
                {creator_avatar ? (
                  <img src={creator_avatar} alt={creator_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-muted-foreground">{creator_name.charAt(0).toUpperCase()}</span>
                )}
              </div>
            </div>
            {creatorVerified && (
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                <CheckCircle2 size={16} className="text-blue-500 fill-blue-500" />
              </div>
            )}
          </Link>
          
          <div>
            <Link href={`/dashboard/creator/${creator_id}`} className="font-bold text-sm text-foreground hover:text-accent transition-colors flex items-center gap-1">
              {creator_name}
              {creatorVerified && <span className="text-blue-500 text-[10px] font-bold bg-blue-50 px-1.5 py-0.5 rounded uppercase">Verificado</span>}
            </Link>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
              Criador de Conteúdo • Agora
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {currentUser && currentUser.id === creator_id && (
            <button 
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors flex items-center justify-center flex-shrink-0 disabled:opacity-50"
              title="Eliminar Publicação"
            >
              {isDeleting ? <Loader2 className="animate-spin w-4 h-4" /> : <Trash2 size={18} />}
            </button>
          )}
          <button className="text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-gray-100"><MoreHorizontal size={20} /></button>
        </div>
      </div>

      {/* Media Content */}
      <div className={`relative w-full h-64 overflow-hidden group ${thumbnail_url ? 'bg-black' : 'bg-gradient-to-br from-gray-100 to-gray-200'}`}>
        {content_type === 'video' ? (
          <div className="w-full h-full relative cursor-pointer" onClick={handlePlayClick}>
            {thumbnail_url ? (
              <video
                ref={videoRef}
                src={content_url}
                onTimeUpdate={handleTimeUpdate}
                className="w-full h-full object-contain"
                poster={thumbnail_url}
                muted={true}
                playsInline
                controls={is_free && isPlaying}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
                <Play size={48} className="text-purple-500 fill-purple-200 ml-2" />
              </div>
            )}

            {/* Play Button Overlay */}
            {!isPlaying && !showCardPaywall && thumbnail_url && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
                  <Play size={32} className="text-white fill-white ml-1" />
                </div>
              </div>
            )}

            {/* Paywall on Card */}
            {showCardPaywall && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center">
                <Lock size={32} className="text-accent mb-2 animate-bounce" />
                <p className="text-white text-xs font-bold uppercase mb-3">Curiosidade esgotada</p>
                <Link
                  href={`/dashboard/post/${id}`}
                  className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg active:scale-95 transition-transform"
                >
                  Pagar AOA {price?.toLocaleString()}
                </Link>
              </div>
            )}

            {/* Expand Icon */}
            <Link
              href={`/dashboard/post/${id}`}
              className="absolute top-4 right-4 p-2 bg-black/40 text-white rounded-lg backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
              onClick={(e) => e.stopPropagation()}
            >
              <Maximize2 size={20} />
            </Link>
          </div>
       ) : (
  <Link href={`/dashboard/post/${id}`} className="block w-full h-full relative">
    <div className="relative w-full h-64">
      {thumbnail_url ? (
        <Image
          src={thumbnail_url}
          alt={title}
          fill
          style={{ width: '100%', height: '100%' }}
          className={`object-cover transition-transform duration-700 group-hover:scale-105 ${!is_free && !isFreePlan && !hasPurchased ? 'blur-sm' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100">
          <div className="text-center">
            <p className="text-4xl mb-2">📝</p>
            <p className="text-sm font-medium text-gray-600">{title}</p>
          </div>
        </div>
      )}
      {!is_free && !hasPurchased && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md">
          <Lock size={48} className="text-white" />
        </div>
      )}
    </div>
  </Link>
) }

        <div className="absolute bottom-4 left-4 flex gap-2">
          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-black/40 text-white backdrop-blur-md border border-white/20">
            {content_type}
          </span>
          {!is_free && !hasPurchased && (
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-accent/80 text-white backdrop-blur-md border border-accent/40">
              AOA {price?.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Info & Stats */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-5">
            <button onClick={handleLike} className="hover:scale-110 transition-transform">
              <Heart size={26} className={isLiked ? 'fill-red-500 text-red-500 scale-110' : 'text-foreground'} />
            </button>
            <button 
              onClick={() => setIsCommentsOpen(true)}
              className="hover:scale-110 transition-transform"
            >
              <MessageCircle size={26} className="text-foreground" />
            </button>
            <button className="hover:scale-110 transition-transform"><Send size={26} className="text-foreground" /></button>
          </div>
          <button className="hover:scale-110 transition-transform"><Bookmark size={26} className="text-foreground" /></button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-5 h-5 rounded-full border-2 border-white bg-gray-200 overflow-hidden">
                <img src={`https://i.pravatar.cc/100?u=${i}`} alt="user" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <span className="text-sm font-bold text-foreground">
            {likesCount > 0 ? `${likesCount.toLocaleString()} curtidas` : 'Sê o primeiro a curtir'}
          </span>
        </div>

        <Link href={`/dashboard/post/${id}`}>
          <h3 className="font-bold text-[15px] leading-snug hover:text-accent transition-colors mb-1">{title}</h3>
        </Link>
        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed mb-4">{description}</p>

        <div className="pt-4 border-t border-gray-50 flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase">
          <button 
            onClick={() => setIsCommentsOpen(true)}
            className="hover:text-accent flex items-center gap-1"
          >
            <MessageSquare size={14} /> {commentsCount > 0 ? `${commentsCount} comentários` : 'Comentar'}
          </button>
          <span>2 horas atrás</span>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <div className="bg-white border border-border rounded-3xl shadow-2xl p-6 max-w-sm w-full text-center relative overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
              <Trash2 size={28} className="animate-bounce" />
            </div>
            <h4 className="text-lg font-extrabold text-gray-900 mb-2">Eliminar Publicação?</h4>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Tem a certeza que deseja eliminar esta publicação permanentemente? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl text-sm transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeletePost}
                disabled={isDeleting}
                className="flex-1 bg-accent hover:bg-accent/90 text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-accent/10 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="animate-spin w-4 h-4" /> : <Trash2 size={16} />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <CommentsModal 
        isOpen={isCommentsOpen} 
        onClose={() => setIsCommentsOpen(false)} 
        postId={id} 
        user={currentUser} 
        content_url={content_url}
        content_type={content_type}
      />
    </div>
  )
}
