'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { CheckCircle2, UserPlus } from 'lucide-react'

interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
}

export default function SuggestedCreators() {
  const [creators, setCreators] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchCreators() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, is_verified')
        .limit(5)
      
      if (!error && data) {
        setCreators(data)
      }
      setLoading(false)
    }

    fetchCreators()
  }, [supabase])

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h3 className="text-lg font-bold text-foreground mb-4">Criadores Recomendados</h3>
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-12 h-12 bg-muted rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-muted w-24 mb-2 rounded"></div>
                <div className="h-3 bg-muted w-16 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (creators.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-md border border-border p-6 shadow-sm sticky top-24">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground tracking-tight">
          Criadores Recomendados
        </h3>
        <span className="text-xs font-semibold text-accent bg-accent/10 px-2 py-1 rounded-full">
          Novo
        </span>
      </div>

      <div className="space-y-5">
        {creators.map((creator: any) => (
          <div key={creator.id} className="flex items-center justify-between group">
            <Link href={`/dashboard/creator/${creator.id}`} className="flex items-center gap-3 cursor-pointer">
              {/* Avatar */}
              <div className="relative">
                {creator.avatar_url ? (
                  <img src={creator.avatar_url} alt={creator.display_name || 'Usuário'} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white text-lg font-bold shadow-sm flex-shrink-0">
                    {creator.display_name ? creator.display_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                {creator.is_verified && (
                  <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                    <CheckCircle2 size={16} className="text-blue-500 fill-blue-500" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground group-hover:text-accent transition-colors flex items-center gap-1">
                  {creator.display_name || 'Usuário Anónimo'}
                  {creator.is_verified && <CheckCircle2 size={14} className="text-blue-500 fill-blue-500" />}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  Produtor de Conteúdo
                </span>
              </div>
            </Link>

            {/* Follow Button */}
            <button className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-white transition-all duration-300">
              <UserPlus size={16} />
            </button>
          </div>
        ))}
      </div>

      <button className="w-full mt-6 py-2.5 text-sm font-semibold text-accent hover:text-white hover:bg-accent border border-accent rounded-md transition-all duration-300">
        Ver todos as sugestões
      </button>
    </div>
  )
}
