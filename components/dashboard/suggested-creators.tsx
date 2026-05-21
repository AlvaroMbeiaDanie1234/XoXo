'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { CheckCircle2, UserPlus } from 'lucide-react'
import UsersPanel from './users-panel'

interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  is_verified?: boolean
  email?: string
}

export default function SuggestedCreators() {
  const [creators, setCreators] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchCreators() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, is_verified, email')
        .order('is_verified', { ascending: false })
        .order('display_name', { ascending: true })

      if (!error && data) {
        setCreators(data)
      }
      setLoading(false)
    }

    fetchCreators()
  }, [supabase])

  return (
    <div className="bg-white rounded-md border border-border p-6 shadow-sm sticky top-24">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground tracking-tight">Criadores Recomendados</h3>
        <span className="text-xs font-semibold text-accent bg-accent/10 px-2 py-1 rounded-full">Novo</span>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
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

      {/* No creators found */}
      {!loading && creators.length === 0 && (
        <p className="text-sm text-gray-400">Nenhum criador encontrado</p>
      )}

      {/* Creators list */}
      {!loading && creators.length > 0 && (
        <div className="space-y-5">
          {creators.map((creator) => (
            <div key={creator.id} className="flex items-center justify-between group">
              <Link href={`/dashboard/creator/${creator.id}`} className="flex items-center gap-3 cursor-pointer">
                <div className="relative w-12 h-12">
                  {creator.avatar_url ? (
                    <img src={creator.avatar_url} alt={creator.display_name || 'Usuário'} className="w-12 h-12 rounded-full object-cover" />
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
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-foreground group-hover:text-accent transition-colors flex items-center gap-1">
                    {creator.display_name || 'Usuário Anónimo'}
                    {creator.is_verified && <CheckCircle2 size={14} className="text-blue-500 fill-blue-500" />}
                  </span>
                  <span className="text-xs text-muted-foreground">Produtor de Conteúdo</span>
                </div>
              </Link>
              <button className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-white transition-all duration-300">
                <UserPlus size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Users panel (optional) */}
      <UsersPanel isOpen={true} onClose={() => {}} />
    </div>
  )
}
