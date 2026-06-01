'use client'

import { useState, useEffect } from 'react'
import { ShieldCheck, ArrowLeft, Loader2, ChevronRight } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatRelativeTime } from '@/lib/format-relative-time'

interface Props {
  supabase: SupabaseClient
  theme: string | undefined
  intelConversations: any[]
  setIntelConversations: (v: any[]) => void
  intelSelectedPair: { userA: string; userB: string; messages: any[] } | null
  setIntelSelectedPair: (v: any) => void
}

export default function IntelligencePanel({
  supabase,
  theme,
  intelConversations,
  setIntelConversations,
  intelSelectedPair,
  setIntelSelectedPair,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)

  useEffect(() => {
    if (intelConversations.length === 0) loadConversations()
  }, [])

  const loadConversations = async () => {
    setLoading(true)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: messages } = await supabase
      .from('messages')
      .select('sender_id, receiver_id, created_at')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })

    if (!messages) { setLoading(false); return }

    const pairMap = new Map<string, { userA: string; userB: string; lastMessage: string; count: number }>()
    for (const m of messages) {
      const a = m.sender_id < m.receiver_id ? m.sender_id : m.receiver_id
      const b = m.sender_id < m.receiver_id ? m.receiver_id : m.sender_id
      const key = `${a}_${b}`
      const existing = pairMap.get(key)
      if (existing) {
        existing.count++
      } else {
        pairMap.set(key, { userA: a, userB: b, lastMessage: m.created_at, count: 1 })
      }
    }

    const userIds = new Set<string>()
    pairMap.forEach(p => { userIds.add(p.userA); userIds.add(p.userB) })

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, email, avatar_url')
      .in('id', [...userIds])

    const profileMap = new Map<string, any>()
    if (profiles) profiles.forEach(p => profileMap.set(p.id, p))

    const pairs = [...pairMap.values()].map(p => ({
      userA: p.userA,
      userB: p.userB,
      profileA: profileMap.get(p.userA) || { display_name: 'Desconhecido', email: '' },
      profileB: profileMap.get(p.userB) || { display_name: 'Desconhecido', email: '' },
      lastMessage: p.lastMessage,
      count: p.count,
    }))

    pairs.sort((a, b) => new Date(b.lastMessage).getTime() - new Date(a.lastMessage).getTime())
    setIntelConversations(pairs)
    setLoading(false)
  }

  const loadMessages = async (userA: string, userB: string) => {
    setLoadingMessages(true)
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userA},receiver_id.eq.${userB}),and(sender_id.eq.${userB},receiver_id.eq.${userA})`)
      .order('created_at', { ascending: true })

    setIntelSelectedPair({ userA, userB, messages: messages || [] })
    setLoadingMessages(false)
  }

  if (intelSelectedPair) {
    const userAProfile = intelConversations.find(
      c => c.userA === intelSelectedPair.userA && c.userB === intelSelectedPair.userB
    )

    return (
      <div className={`rounded-2xl border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 bg-card border-border`}>
        <div className={`p-6 border-b flex items-center gap-3 border-border`}>
          <button onClick={() => setIntelSelectedPair(null)} className={`p-2 rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400`}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h3 className="font-bold text-sm">{userAProfile?.profileA?.display_name || 'User'} ↔ {userAProfile?.profileB?.display_name || 'User'}</h3>
            <p className="text-[10px] text-gray-400">{intelSelectedPair.messages.length} mensagens</p>
          </div>
        </div>
        <div className="p-6 max-h-[500px] overflow-y-auto space-y-3">
          {loadingMessages ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-accent" /></div>
          ) : (
            intelSelectedPair.messages.map((msg: any) => (
              <div key={msg.id} className={`p-3 rounded-xl text-sm ${msg.sender_id === intelSelectedPair.userA ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-gray-500">
                    {msg.sender_id === intelSelectedPair.userA
                      ? (userAProfile?.profileA?.display_name || 'User A')
                      : (userAProfile?.profileB?.display_name || 'User B')}
                  </span>
                  <span className="text-[10px] text-gray-400">{formatRelativeTime(msg.created_at)}</span>
                </div>
                <p className="text-gray-800">{msg.content}</p>
                {msg.file_url && (
                  <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="text-accent text-xs font-bold mt-1 inline-block hover:underline">
                    📎 Ver ficheiro
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 bg-card border-border`}>
      <div className={`p-6 border-b flex items-center justify-between border-border`}>
        <h2 className="text-xl font-black flex items-center gap-2">
          <ShieldCheck size={24} className="text-accent" />
          Análise de Inteligência
        </h2>
        <span className="text-xs text-gray-400">{intelConversations.length} conversas</span>
      </div>
      <div className="divide-y">
        {loading ? (
          <div className="p-10 text-center"><Loader2 className="animate-spin text-accent mx-auto" size={24} /></div>
        ) : intelConversations.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">Nenhuma conversa encontrada.</div>
        ) : (
          intelConversations.map((pair, i) => (
            <button
              key={i}
              onClick={() => loadMessages(pair.userA, pair.userB)}
              className={`w-full flex items-center gap-4 p-4 sm:p-5 text-left transition-colors hover:bg-accent hover:text-accent-foreground`}
            >
              <div className="flex items-center -space-x-2 flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white font-bold text-xs border-2 border-white">
                  {pair.profileA?.avatar_url ? <img src={pair.profileA.avatar_url} className="w-full h-full object-cover rounded-full" /> : pair.profileA?.display_name?.charAt(0) || '?'}
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs border-2 border-white">
                  {pair.profileB?.avatar_url ? <img src={pair.profileB.avatar_url} className="w-full h-full object-cover rounded-full" /> : pair.profileB?.display_name?.charAt(0) || '?'}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">
                  {pair.profileA?.display_name || 'User'} ↔ {pair.profileB?.display_name || 'User'}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {pair.profileA?.email || ''} | {pair.profileB?.email || ''}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-gray-400">{formatRelativeTime(pair.lastMessage)}</p>
                <p className="text-[10px] font-bold text-accent mt-0.5">{pair.count} msg</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}