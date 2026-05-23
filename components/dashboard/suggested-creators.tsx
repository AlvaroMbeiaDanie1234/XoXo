'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback, useRef } from 'react'
import { CheckCircle2, UserPlus, RefreshCw, ChevronDown } from 'lucide-react'
import type { CreatorProfile } from '@/lib/creators'

export default function SuggestedCreators() {
  const [creators, setCreators] = useState<CreatorProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showScrollHint, setShowScrollHint] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const fetchCreators = useCallback(async () => {
    try {
      const res = await fetch('/api/creators/suggested', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setCreators(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Erro ao carregar criadores:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchCreators()
    const interval = setInterval(fetchCreators, 45000)
    return () => clearInterval(interval)
  }, [fetchCreators])

  useEffect(() => {
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
  }, [creators])

  return (
    <div className="bg-white rounded-md border border-border p-6 shadow-sm sticky top-24 flex flex-col max-h-[min(520px,calc(100vh-120px))]">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-bold text-foreground tracking-tight">Criadores Recomendados</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              fetchCreators()
            }}
            className="p-1.5 text-gray-400 hover:text-accent rounded-full hover:bg-gray-100 transition-colors"
            title="Atualizar lista"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <span className="text-xs font-semibold text-accent bg-accent/10 px-2 py-1 rounded-full">
            {creators.length}
          </span>
        </div>
      </div>

      {loading && creators.length === 0 && (
        <div className="space-y-4 animate-pulse flex-shrink-0">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-12 h-12 bg-muted rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-muted w-24 mb-2 rounded" />
                <div className="h-3 bg-muted w-16 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && creators.length === 0 && (
        <p className="text-sm text-gray-400 flex-shrink-0">Nenhum criador encontrado</p>
      )}

      {creators.length > 0 && (
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div
            ref={listRef}
            className="creators-scroll space-y-3 overflow-y-auto flex-1 min-h-0 pr-1 -mr-1"
          >
            {creators.map((creator) => (
              <div
                key={creator.id}
                className="flex items-center justify-between group flex-shrink-0 py-1.5 px-1 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Link
                  href={`/dashboard/creator/${creator.id}`}
                  className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                >
                  <div className="relative w-12 h-12 flex-shrink-0">
                    {creator.avatar_url ? (
                      <img
                        src={creator.avatar_url}
                        alt={creator.display_name || 'Usuário'}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white text-lg font-bold shadow-sm">
                        {creator.display_name ? creator.display_name.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    {creator.is_verified && (
                      <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                        <CheckCircle2 size={16} className="text-blue-500 fill-blue-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-foreground group-hover:text-accent transition-colors flex items-center gap-1 truncate">
                      {creator.display_name || 'Utilizador Anónimo'}
                      {creator.is_verified && (
                        <CheckCircle2 size={14} className="text-blue-500 fill-blue-500 flex-shrink-0" />
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">Produtor de Conteúdo</span>
                  </div>
                </Link>
                <Link
                  href={`/dashboard/messages?user=${creator.id}`}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-white transition-all duration-300 flex-shrink-0 ml-2"
                  title="Enviar mensagem"
                >
                  <UserPlus size={16} />
                </Link>
              </div>
            ))}
          </div>

          {showScrollHint && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white via-white/80 to-transparent flex items-end justify-center pb-1 flex-shrink-0">
              <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
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
