'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/components/dashboard/header'
import Sidebar from '@/components/dashboard/sidebar'
import { useToast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import { readTimedCache, writeTimedCache } from '@/lib/client-cache'
import {
  Loader2, Lock, DollarSign, Play, CheckCircle, Heart,
  MessageCircle, Bookmark, Star, ArrowRight, Send, Reply, Trash2, CheckCheck, Check
} from 'lucide-react'

export default function PostDetailsPage() {
  const POST_DETAILS_CACHE_TTL_MS = 60 * 1000
  const PAID_PREVIEW_SECONDS = 1
  const { toast } = useToast()
  const params = useParams()
  const id = params.id as string
  const [post, setPost] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [hasAccess, setHasAccess] = useState(false)
  const [buying, setBuying] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  
  // Comments state
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<any>(null)
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Tip state
  const [showTipModal, setShowTipModal] = useState(false)
  const [tipAmount, setTipAmount] = useState('')
  const [sendingTip, setSendingTip] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
      const cacheKey = `xoxo:post:details:${id}`
      const cached = readTimedCache<{
        post: any
        hasAccess: boolean
        showPaywall: boolean
      }>(cacheKey, POST_DETAILS_CACHE_TTL_MS)

      if (cached?.post) {
        setPost(cached.post)
        setHasAccess(Boolean(cached.hasAccess))
        setShowPaywall(Boolean(cached.showPaywall))
        setLoading(false)
      }

      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      // Fetch Post
      const { data: postData } = await supabase
        .from('posts')
        .select('*, profiles(display_name, avatar_url, is_verified)')
        .eq('id', id)
        .single()
      
      if (!postData) {
        setLoading(false)
        return
      }
      setPost(postData)

      let computedHasAccess = false
      let computedShowPaywall = false

      // Check access
      if (postData.is_free || postData.user_id === user?.id) {
        setHasAccess(true)
        computedHasAccess = true
      } else if (user) {
        const { data: profile } = await supabase.from('profiles').select('is_free_plan').eq('id', user.id).single()
        if (profile?.is_free_plan) {
          setHasAccess(true)
          computedHasAccess = true
        } else {
          const { data: purchase } = await supabase
            .from('purchases')
            .select('*')
            .eq('user_id', user.id)
            .eq('post_id', id)
            .single()
          
          if (purchase) {
            setHasAccess(true)
            computedHasAccess = true
          } else {
            const paywall = !postData.is_free
            setShowPaywall(paywall)
            computedShowPaywall = paywall
          }
        }
      } else {
        const paywall = !postData.is_free
        setShowPaywall(paywall)
        computedShowPaywall = paywall
      }

      // Fetch Comments
      fetchComments()

      writeTimedCache(cacheKey, {
        post: postData,
        hasAccess: computedHasAccess,
        showPaywall: computedShowPaywall,
      })
      setLoading(false)
    }

    loadData()
  }, [id, supabase])

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(display_name, avatar_url)')
      .eq('post_id', id)
      .order('created_at', { ascending: true })
    
    if (data) {
      // Organize into tree (simple 2-level for now)
      const rootComments = data.filter(c => !c.parent_id)
      const replies = data.filter(c => c.parent_id)
      
      const tree = rootComments.map(c => ({
        ...c,
        replies: replies.filter(r => r.parent_id === c.id)
      }))
      
      setComments(tree)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowDeleteModal(true)
  }

  const confirmDeletePost = async () => {
    setDeleting(true)
    try {
      // Proactively delete likes, comments, and favorites first to prevent database foreign key constraint errors
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

      toast({
        title: "Publicação eliminada",
        description: "A tua publicação foi eliminada com sucesso!",
      })
      router.push('/dashboard')
    } catch (err: any) {
      console.error(err)
      toast({
        title: "Erro ao eliminar",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const handleTimeUpdate = () => {
    if (!hasAccess && videoRef.current && videoRef.current.currentTime >= PAID_PREVIEW_SECONDS) {
      videoRef.current.pause()
      setShowPaywall(true)
    }
  }

  const handleBuy = async () => {
    if (!user) {
      toast({
        title: "Login necessário",
        description: "Faz login para poderes adquirir este conteúdo!",
        variant: "destructive"
      })
      return
    }
    
    // 1. Check current balance
    const { data: profile } = await supabase.from('profiles').select('balance, display_name').eq('id', user.id).single()
    const currentBalance = profile?.balance || 0
    const buyerName = profile?.display_name || user.email?.split('@')[0] || 'Alguém'

    if (currentBalance < post.price) {
      toast({
        title: "Saldo Insuficiente",
        description: "Desejas carregar a tua carteira agora para adquirir este conteúdo?",
        action: (
          <ToastAction
            altText="Carregar"
            onClick={() => router.push('/dashboard?mode=wallet&view=deposit')}
          >
            Carregar
          </ToastAction>
        )
      })
      return
    }

    setBuying(true)
    try {
      // 1. Record Purchase
      await supabase.from('purchases').insert({
        user_id: user.id,
        post_id: id,
        amount: post.price,
        status: 'completed'
      })

      // 2. Record Transaction for Buyer (Purchase)
      // This will automatically deduct the balance via the Postgres trigger
      await supabase.from('transactions').insert({
        user_id: user.id,
        amount: post.price,
        type: 'purchase',
        description: `Compra de conteúdo: ${post.title}`,
        status: 'completed'
      })

      // Fetch transaction fee from settings
      const { data: feeSetting } = await supabase.from('system_settings').select('*').eq('key', 'transaction_fee_percent').single()
      const feePercent = feeSetting ? Number(feeSetting.value) : 10
      const feeAmount = (post.price * feePercent) / 100
      const creatorEarnings = post.price - feeAmount

      // 3. Record Transaction for Creator (Earnings)
      await supabase.from('transactions').insert({
        user_id: post.user_id,
        amount: creatorEarnings,
        type: 'earnings',
        description: `${buyerName} comprou o teu conteúdo: ${post.title} (Comissão de ${feePercent}% deduzida)`,
        status: 'completed'
      })

      // 4. Automatically add to Favorites
      await supabase.from('favorites').insert({
        user_id: user.id,
        post_id: id
      })

      setHasAccess(true)
      setShowPaywall(false)
      if (videoRef.current) videoRef.current.play()
      window.dispatchEvent(new CustomEvent('balanceUpdated'))

      // Send SMS to buyer (non-blocking)
      fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          body: `Compra concluída! Desbloqueou o conteúdo "${post.title}" por AOA ${post.price?.toLocaleString()}. Boa visualização!`
        })
      }).catch(console.warn)

      // Send SMS to creator (non-blocking)
      fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: post.user_id,
          body: `${buyerName} comprou o seu conteúdo "${post.title}" por AOA ${post.price?.toLocaleString()}. Os seus ganhos foram creditados na sua carteira!`
        })
      }).catch(console.warn)

      toast({
        title: "Conteúdo Adquirido!",
        description: "Compra efetuada com sucesso e adicionado aos teus Comprados.",
      })

    } catch (err: any) {
      toast({
        title: "Erro na compra",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setBuying(false)
    }
  }

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newComment.trim()) return

    setIsSubmittingComment(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: id,
          content: newComment,
          parent_id: replyTo?.id || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'DEPOSIT_REQUIRED') {
          toast({
            title: 'Depósito necessário',
            description: data.message,
            variant: 'destructive',
          })
          router.push('/dashboard?mode=wallet&view=deposit&required=1')
          return
        }
        throw new Error(data.message || data.error)
      }
      setNewComment('')
      setReplyTo(null)
      fetchComments()
    } catch (err: any) {
      toast({
        title: "Erro ao comentar",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleSendTip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !tipAmount.trim()) return

    const amount = Number(tipAmount)
    if (amount < 300) {
      toast({
        title: "Valor mínimo",
        description: "A gorjeta mínima é de 300 AOA",
        variant: "destructive"
      })
      return
    }

    setSendingTip(true)
    try {
      const res = await fetch('/api/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: id,
          amount,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || data.error)
      }

      toast({
        title: "Gorjeta enviada!",
        description: `Enviaste ${amount.toLocaleString()} AOA ao criador.`,
      })

      setTipAmount('')
      setShowTipModal(false)
      window.dispatchEvent(new CustomEvent('balanceUpdated'))
    } catch (err: any) {
      toast({
        title: "Erro ao enviar gorjeta",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setSendingTip(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="animate-spin text-accent" size={32} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f3f2ef] pb-12 relative">
      <Header user={user} />

      <div className="max-w-[1128px] mx-auto flex justify-center gap-6 pt-6 px-4 relative z-10">
        <div className="hidden lg:block w-[225px] flex-shrink-0">
          <Sidebar />
        </div>

        <div className="flex-1 max-w-[800px] w-full relative z-10">
          {/* Post Card */}
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden mb-6 relative z-10">
            <div className={`aspect-video relative flex items-center justify-center overflow-hidden ${post.content_type === 'article' && !post.thumbnail_url ? 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50' : 'bg-black'}`}>
              {post.content_type === 'video' ? (
                <video
                  ref={videoRef}
                  src={post.content_url}
                  controls={hasAccess || !showPaywall}
                  onTimeUpdate={handleTimeUpdate}
                  className="w-full h-full object-contain"
                  autoPlay={!showPaywall}
                  muted={!hasAccess}
                />
              ) : post.content_type === 'article' && !post.thumbnail_url ? (
                <div className="text-center p-6 max-w-lg relative bg-gray-100">
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 bg-[url('/xoxo.png')] bg-center bg-contain bg-no-repeat"></div>
                  <div className="relative z-10">
                    <h2 className="text-2xl font-bold text-gray-900 mb-3 font-montserrat">{post.title}</h2>
                    <p className="text-gray-600 leading-relaxed font-montserrat">{post.description}</p>
                  </div>
                </div>
              ) : (
                <img src={post.content_url} alt={post.title} className="w-full h-full object-contain" />
              )}

              {showPaywall && !hasAccess && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in duration-500 z-50">
                  <div className="w-20 h-20 md:w-24 md:h-24 bg-accent rounded-full flex items-center justify-center mb-4 md:mb-6 shadow-2xl shadow-accent/40 animate-bounce flex-shrink-0">
                    <Lock size={36} className="text-white md:hidden" />
                    <Lock size={44} className="text-white hidden md:block" />
                  </div>
                  <div className="text-center px-4 max-w-sm flex-shrink-0">
                    <h2 className="text-2xl md:text-3xl font-black text-white mb-2 tracking-tighter uppercase">Quer continuar a ver?</h2>
                    <p className="text-gray-300 text-xs md:text-sm mb-4 md:mb-8">
                      O tempo de curiosidade de {PAID_PREVIEW_SECONDS} segundo{PAID_PREVIEW_SECONDS > 1 ? 's' : ''} acabou. Desbloqueia agora para assistir ao conteúdo completo.
                    </p>
                  </div>
                  <div className="flex flex-col items-center w-full max-w-xs flex-shrink-0">
                    <div className="bg-white p-1 rounded-2xl flex flex-col items-center w-full shadow-2xl">
                      <div className="w-full bg-gray-50 py-3 md:py-4 rounded-xl flex flex-col items-center border border-gray-100">
                         <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Preço do Acesso</span>
                         <span className="text-2xl md:text-3xl font-black text-accent tracking-tighter">AOA {post.price?.toLocaleString()}</span>
                      </div>
                      <button onClick={handleBuy} disabled={buying} className="w-full mt-1 bg-accent hover:bg-accent/90 text-white py-3 md:py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3">
                        {buying ? (
                          <>
                            <Loader2 size={20} className="animate-spin md:hidden" />
                            <Loader2 size={24} className="animate-spin hidden md:block" />
                          </>
                        ) : (
                          <>
                            <Play size={16} className="fill-white md:hidden" />
                            <Play size={20} className="fill-white hidden md:block" />
                          </>
                        )}
                        <span className="text-base md:text-lg">Pagar {post.price?.toLocaleString()}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-accent to-purple-500 p-[2px]">
                    <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-muted">
                      {post.profiles?.avatar_url && <img src={post.profiles.avatar_url} alt="avatar" className="w-full h-full object-cover" />}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg flex items-center gap-1">
                      {post.profiles?.display_name || 'Usuário'}
                    </h3>
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Criador de Conteúdo</p>
                  </div>
                </div>

                {user && user.id === post.user_id && (
                  <button
                    onClick={handleDeleteClick}
                    disabled={deleting}
                    className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-sm border border-red-100"
                  >
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Eliminar Conteúdo
                  </button>
                )}

                {user && user.id !== post.user_id && (
                  <button
                    onClick={() => setShowTipModal(true)}
                    className="flex items-center gap-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-600 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm border border-yellow-100"
                  >
                    <DollarSign size={14} />
                    Enviar Gorjeta
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                <h1 className="text-2xl font-bold">{post.title}</h1>
                {!post.is_free && post.user_id !== user?.id && hasAccess && (
                  <span className="px-3 py-1 bg-green-50 text-green-600 border border-green-200 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm animate-in fade-in slide-in-from-top-1 duration-300">
                    <CheckCircle size={14} className="fill-green-100" />
                    Conteúdo Adquirido (Pago)
                  </span>
                )}
              </div>
              <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{post.description}</p>
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-6 mb-12 relative z-10">
            <h3 className="font-bold text-xl mb-6">Comentários ({comments.reduce((acc, c) => acc + 1 + c.replies.length, 0)})</h3>

            {/* Comment Form */}
            {user ? (
              <form onSubmit={handleCommentSubmit} className="mb-8 relative z-10">
                {replyTo && (
                  <div className="flex items-center justify-between bg-gray-50 p-2 rounded-t-lg border-x border-t border-border">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Reply size={12} /> Respondendo a <strong>{replyTo.profiles?.display_name}</strong>
                    </span>
                    <button type="button" onClick={() => setReplyTo(null)} className="text-xs text-red-500 hover:underline">Cancelar</button>
                  </div>
                )}
                <div className="flex gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-accent flex items-center justify-center text-white font-bold text-xs md:text-sm flex-shrink-0">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 relative">
                    <textarea
                      placeholder="Escreve um comentário..."
                      className={`w-full bg-gray-50 border border-border p-2 md:p-3 text-sm md:text-base outline-none focus:border-accent transition-colors resize-none ${replyTo ? 'rounded-b-lg' : 'rounded-lg'}`}
                      rows={2}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingComment || !newComment.trim()}
                      className="absolute right-2 md:right-3 bottom-2 md:bottom-3 text-accent hover:text-accent/80 disabled:opacity-50"
                    >
                      {isSubmittingComment ? (
                        <>
                          <Loader2 size={16} className="animate-spin md:hidden" />
                          <Loader2 size={20} className="animate-spin hidden md:block" />
                        </>
                      ) : (
                        <>
                          <Send size={16} className="md:hidden" />
                          <Send size={20} className="hidden md:block" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg text-center mb-8 border border-border">
                <p className="text-sm text-gray-600">Faz login para deixar um comentário.</p>
              </div>
            )}

            {/* Comments List */}
            <div className="space-y-6 relative z-10">
              {comments.map((comment) => (
                <div key={comment.id} className="space-y-4">
                  {/* Root Comment */}
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      {comment.profiles?.avatar_url && <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="font-bold text-sm">{comment.profiles?.display_name}</span>
                        </div>
                        <p className="text-sm text-gray-800 leading-relaxed">{comment.content}</p>
                      </div>
                      <div className="flex items-center gap-4 mt-2 ml-2">
                        <button className="text-xs font-bold text-gray-500 hover:text-accent">Gostar</button>
                        <button 
                          onClick={() => setReplyTo(comment)}
                          className="text-xs font-bold text-gray-500 hover:text-accent flex items-center gap-1"
                        >
                          <Reply size={12} /> Responder
                        </button>
                        <span className="text-[10px] text-gray-400 uppercase">{new Date(comment.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Replies */}
                  {comment.replies?.map((reply: any) => (
                    <div key={reply.id} className="flex gap-3 ml-12">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
                        {reply.profiles?.avatar_url && <img src={reply.profiles.avatar_url} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1">
                        <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="font-bold text-xs">{reply.profiles?.display_name}</span>
                          </div>
                          <p className="text-xs text-gray-800 leading-relaxed">{reply.content}</p>
                        </div>
                        <div className="flex items-center gap-4 mt-1 ml-2">
                          <button className="text-[10px] font-bold text-gray-500 hover:text-accent">Gostar</button>
                          <span className="text-[10px] text-gray-400 uppercase">{new Date(reply.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {comments.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p>Ainda não há comentários. Sê o primeiro!</p>
                </div>
              )}
            </div>
          </div>
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
                disabled={deleting}
                className="flex-1 bg-accent hover:bg-accent/90 text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-accent/10 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                {deleting ? <Loader2 className="animate-spin w-4 h-4" /> : <Trash2 size={16} />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {showTipModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <div className="bg-white border border-border rounded-3xl shadow-2xl p-6 max-w-sm w-full text-center relative overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-100">
              <DollarSign size={28} />
            </div>
            <h4 className="text-lg font-extrabold text-gray-900 mb-2">Enviar Gorjeta</h4>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Envia uma gorjeta ao criador deste conteúdo. Valor mínimo: 300 AOA.
            </p>
            <form onSubmit={handleSendTip} className="space-y-4">
              <div>
                <input
                  type="number"
                  min="300"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  placeholder="Valor (AOA)"
                  className="w-full px-4 py-3 border border-border rounded-xl text-center font-bold text-lg focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowTipModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sendingTip}
                  className="flex-1 bg-accent hover:bg-accent/90 text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-accent/10 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {sendingTip ? <Loader2 className="animate-spin w-4 h-4" /> : <Send size={16} />}
                  Enviar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
