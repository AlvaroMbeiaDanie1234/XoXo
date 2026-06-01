'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { CheckCircle2, UserPlus, UserMinus, RefreshCw, ChevronDown, Eye, X, Loader2 } from 'lucide-react'
import type { CreatorProfile } from '@/lib/creators'
import { createClient } from '@/lib/supabase/client'

interface SuggestedCreatorsProps {
  variant?: 'sidebar' | 'mobile'
  className?: string
}

export default function SuggestedCreators({ variant = 'sidebar', className = '' }: SuggestedCreatorsProps) {
  const [creators, setCreators] = useState<CreatorProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showScrollHint, setShowScrollHint] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [subscribedIds, setSubscribedIds] = useState<Set<string>>(new Set())
  const [subscribingId, setSubscribingId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const isMobileVariant = variant === 'mobile'
  const supabase = useMemo(() => createClient(), [])

  const fetchSubscribedIds = useCallback(async (userId: string, creatorList: CreatorProfile[]) => {
    const creatorIds = creatorList.map((creator) => creator.id).filter((id) => id !== userId)
    if (creatorIds.length === 0) {
      setSubscribedIds(new Set())
      return
    }

    const { data } = await supabase
      .from('subscriptions')
      .select('following_id')
      .eq('follower_id', userId)
      .in('following_id', creatorIds)

    setSubscribedIds(new Set(data?.map((item) => item.following_id) || []))
  }, [supabase])

  const fetchCreators = useCallback(async () => {
    try {
      const res = await fetch('/api/creators/suggested', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const nextCreators = Array.isArray(data) ? data : []
        setCreators(nextCreators)
        if (currentUserId) {
          fetchSubscribedIds(currentUserId, nextCreators)
        }
      }
    } catch (err) {
      console.error('Erro ao carregar criadores:', err)
    } finally {
      setLoading(false)
    }
  }, [currentUserId, fetchSubscribedIds])

  useEffect(() => {
    if (isMobileVariant && localStorage.getItem('xoxo:suggested-creators-mobile-dismissed') === '1') {
      setDismissed(true)
      setLoading(false)
      return
    }

    setLoading(true)
    fetchCreators()
    const interval = setInterval(fetchCreators, 300000)
    return () => clearInterval(interval)
  }, [fetchCreators, isMobileVariant])

  useEffect(() => {
    async function loadCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)
      if (user) {
        fetchSubscribedIds(user.id, creators)
      }
    }

    loadCurrentUser()
  }, [supabase, fetchSubscribedIds, creators])

  useEffect(() => {
    if (isMobileVariant) {
      setShowScrollHint(false)
      return
    }

    const el = listRef.current
    if (!el) return

    const checkScroll = () => {
      setShowScrollHint(el.scrollHeight > el.clientHeight + 8 && el.scrollTop < el.scrollHeight - el.clientHeight - 20)
    }

    checkScroll()
    el.addEventListener('scroll', checkScroll)
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [creators, isMobileVariant])

  const getPostLabel = (postCount?: number) => {
    if (!postCount) return 'Novo criador'
    return `${postCount} conteudo${postCount === 1 ? '' : 's'}`
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('xoxo:suggested-creators-mobile-dismissed', '1')
  }

  const handleSubscribe = async (creator: CreatorProfile) => {
    if (!currentUserId) {
      alert('Faz login para subscrever!')
      return
    }

    if (currentUserId === creator.id) return

    const isSubscribed = subscribedIds.has(creator.id)
    setSubscribingId(creator.id)

    try {
      if (isSubscribed) {
        const { error } = await supabase
          .from('subscriptions')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', creator.id)
        if (error) throw error

        setSubscribedIds((prev) => {
          const next = new Set(prev)
          next.delete(creator.id)
          return next
        })
      } else {
        const { error } = await supabase
          .from('subscriptions')
          .insert({
            follower_id: currentUserId,
            following_id: creator.id,
          })
        if (error) throw error

        setSubscribedIds((prev) => new Set(prev).add(creator.id))

        const { data: followerProfile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', currentUserId)
          .single()

        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: creator.id,
            title: 'Novo Subscritor',
            message: `${followerProfile?.display_name || 'Um utilizador'} subscreveu ao teu perfil!`,
            type: 'subscription',
          }),
        })
      }
    } catch (error) {
      console.error('Erro ao atualizar subscricao:', error)
      alert('Nao foi possivel atualizar a subscricao. Tenta novamente.')
    } finally {
      setSubscribingId(null)
    }
  }

  if (isMobileVariant && dismissed) return null

  return (
    <div className={`${isMobileVariant ? 'flex w-full flex-col rounded-none border-x-0 border-y p-4 shadow-sm transition-colors duration-300 sm:rounded-md sm:border' : 'rounded-md border p-6 shadow-sm sticky top-24 flex flex-col max-h-[min(520px,calc(100vh-120px))] transition-colors duration-300'} bg-card border-border ${className}`}>
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className={`${isMobileVariant ? 'text-base' : 'text-lg'} font-bold tracking-tight text-foreground`}>Criadores Recomendados</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              fetchCreators()
            }}
            className={`p-1.5 rounded-full transition-colors text-muted-foreground hover:text-accent hover:bg-accent`}
            title="Atualizar lista"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <span className="text-xs font-semibold text-accent bg-accent/10 px-2 py-1 rounded-full">
            {creators.length}
          </span>
          {isMobileVariant && (
            <button
              type="button"
              onClick={handleDismiss}
              className={`p-1.5 rounded-full transition-colors text-muted-foreground hover:text-foreground hover:bg-accent`}
              title="Fechar recomendados"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {loading && creators.length === 0 && (
        <div className="space-y-4 animate-pulse flex-shrink-0">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted" />
              <div className="flex-1">
                <div className="h-4 w-24 mb-2 rounded bg-muted" />
                <div className="h-3 w-16 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && creators.length === 0 && (
        <p className="text-sm flex-shrink-0 text-muted-foreground">Nenhum criador encontrado</p>
      )}

      {creators.length > 0 && (
        <div className={isMobileVariant ? 'relative' : 'relative flex-1 min-h-0 flex flex-col'}>
          <div
            ref={listRef}
            className={isMobileVariant ? 'creators-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-1' : 'creators-scroll space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 -mr-1'}
          >
            {creators.map((creator) => (
              <div
                key={creator.id}
                className={`group flex flex-shrink-0 rounded-lg transition-colors ${isMobileVariant ? `w-[calc(100vw-2rem)] flex-col gap-3 border p-3 border-border bg-muted` : `items-center py-1.5 px-1 gap-2 hover:bg-accent hover:text-accent-foreground`}`}
              >
                <Link
                  href={`/dashboard/creator/${creator.id}`}
                  className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                >
                  <div className="relative w-10 h-10 flex-shrink-0">
                    {creator.avatar_url ? (
                      <img
                        src={creator.avatar_url}
                        alt={creator.display_name || 'Usuário'}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white text-sm font-bold shadow-sm">
                        {creator.display_name ? creator.display_name.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    {creator.is_verified && (
                      <div className={`absolute -bottom-1 -right-1 rounded-full p-0.5 bg-background dark:bg-card`}>
                        <CheckCircle2 size={14} className="text-blue-500 fill-blue-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className={`text-sm font-bold group-hover:text-accent transition-colors flex items-center gap-1 truncate text-foreground`}>
                      {creator.display_name || 'Utilizador Anónimo'}
                      {creator.is_verified && (
                        <CheckCircle2 size={14} className="text-blue-500 fill-blue-500 flex-shrink-0" />
                      )}
                    </span>
                    <span className={`text-xs whitespace-nowrap text-muted-foreground`}>{getPostLabel(creator.post_count)}</span>
                  </div>
                </Link>
                <div className={`flex flex-shrink-0 gap-1 ${isMobileVariant ? 'w-full' : ''}`}>
                    <Link
                      href={`/dashboard/creator/${creator.id}`}
                      className={`flex min-h-8 items-center justify-center rounded-full w-8 text-xs font-bold transition-colors ${isMobileVariant ? 'flex-1 px-3' : ''} bg-muted text-foreground hover:bg-accent hover:text-accent-foreground`}
                      title="Visualizar perfil"
                    >
                      <Eye size={14} />
                      <span className={`${isMobileVariant ? 'ml-1.5' : 'hidden'}`}>Ver</span>
                    </Link>

                    {currentUserId !== creator.id && (
                      <button
                        type="button"
                        onClick={() => handleSubscribe(creator)}
                        disabled={subscribingId === creator.id}
                        className={`flex min-h-8 items-center justify-center rounded-full w-8 text-xs font-bold transition-colors disabled:opacity-60 ${isMobileVariant ? 'flex-1 px-3' : ''} ${
                          subscribedIds.has(creator.id)
                            ? 'bg-muted text-muted-foreground dark:text-foreground hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-300'
                            : 'bg-accent text-white hover:bg-accent/90'
                        }`}
                        title={subscribedIds.has(creator.id) ? 'Remover subscricao' : 'Subscrever'}
                      >
                        {subscribingId === creator.id ? <Loader2 size={14} className="animate-spin" /> : subscribedIds.has(creator.id) ? <UserMinus size={14} /> : <UserPlus size={14} />}
                        <span className={`${isMobileVariant ? 'ml-1.5' : 'hidden'}`}>{subscribedIds.has(creator.id) ? 'Subscrito' : 'Subscrever'}</span>
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>

          {showScrollHint && (
            <div className={`pointer-events-none absolute bottom-0 left-0 right-0 h-12 flex items-end justify-center pb-1 flex-shrink-0 bg-gradient-to-t from-card via-card/80 to-transparent`}>
              <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground`}>
                <ChevronDown size={12} className="animate-bounce" />
                Desliza para ver mais
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
