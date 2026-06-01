'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Loader2, X, Image as ImageIcon, Send, Eye, ChevronLeft, Crown } from 'lucide-react'
import { formatRelativeTime } from '@/lib/format-relative-time'

interface StoryItem {
  id: string
  media_url: string | null
  content: string | null
  created_at: string
  story_views: { count: number }[]
}

interface StoryUser {
  id: string
  display_name: string
  avatar_url: string | null
  email?: string | null
  stories: StoryItem[]
}

interface Viewer {
  user_id: string
  created_at: string
  profiles: {
    display_name: string
    avatar_url: string | null
  }
}

export default function StoriesBar({ currentUserId }: { currentUserId: string | null }) {
  const [storyUsers, setStoryUsers] = useState<StoryUser[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingIndex, setViewingIndex] = useState<number | null>(null)
  const [viewingStoryIndex, setViewingStoryIndex] = useState(0)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newStoryContent, setNewStoryContent] = useState('')
  const [newStoryFile, setNewStoryFile] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewers, setViewers] = useState<Viewer[]>([])
  const [showViewers, setShowViewers] = useState(false)
  const [loadingViewers, setLoadingViewers] = useState(false)
  const progressRef = useRef<number>(0)
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  const checkProfileReady = async (): Promise<boolean> => {
    if (!currentUserId) return false
    const { data } = await supabase
      .from('profiles')
      .select('phone, avatar_url')
      .eq('id', currentUserId)
      .single()
    const ready = !!(data?.phone && data?.avatar_url)
    if (!ready) alert('Para publicar estados, precisas de adicionar um número de telefone e uma foto de perfil na página de perfil.')
    return ready
  }

  useEffect(() => {
    loadStories()
  }, [])

  useEffect(() => {
    if (viewingIndex !== null) {
      startProgress()
      recordView()
    }
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    }
  }, [viewingIndex, viewingStoryIndex])

  const loadStories = async () => {
    const res = await fetch('/api/stories')
    if (res.ok) {
      const data = await res.json()
      const grouped = new Map<string, StoryUser>()
      for (const s of data) {
        if (!grouped.has(s.user_id)) {
          grouped.set(s.user_id, {
            id: s.user_id,
            display_name: s.profiles?.display_name || 'Usuário',
            avatar_url: s.profiles?.avatar_url || null,
            email: s.profiles?.email || null,
            stories: [],
          })
        }
        grouped.get(s.user_id)!.stories.push({
          id: s.id,
          media_url: s.media_url,
          content: s.content,
          created_at: s.created_at,
          story_views: s.story_views || [],
        })
      }
      const isSuperAdmin = (u: StoryUser) =>
        u.email?.toLowerCase() === 'superadmin.xoxo@gmail.com'
      const ownFirst = [...grouped.values()].sort((a, b) => {
        if (a.id === currentUserId) return -1
        if (b.id === currentUserId) return 1
        if (isSuperAdmin(a) && !isSuperAdmin(b)) return -1
        if (isSuperAdmin(b) && !isSuperAdmin(a)) return 1
        return 0
      })
      setStoryUsers(ownFirst)
    }
    setLoading(false)
  }

  const recordView = async () => {
    if (viewingIndex === null) return
    const story = storyUsers[viewingIndex]?.stories[viewingStoryIndex]
    if (!story || storyUsers[viewingIndex]?.id === currentUserId) return
    await fetch(`/api/stories/${story.id}/view`, { method: 'POST' })
  }

  const startProgress = () => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    progressRef.current = 0
    const user = storyUsers[viewingIndex!]
    if (!user) return
    const totalStories = user.stories.length
    const duration = 5000
    const interval = 50
    progressTimerRef.current = setInterval(() => {
      progressRef.current += (interval / duration) * 100
      if (progressRef.current >= 100) {
        if (viewingStoryIndex < totalStories - 1) {
          setViewingStoryIndex(prev => prev + 1)
        } else if (viewingIndex! < storyUsers.length - 1) {
          setViewingIndex(prev => prev! + 1)
          setViewingStoryIndex(0)
        } else {
          setViewingIndex(null)
          setViewingStoryIndex(0)
          setShowViewers(false)
        }
      }
    }, interval)
  }

  const handlePrevStory = () => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    if (viewingStoryIndex > 0) {
      setViewingStoryIndex(prev => prev - 1)
    } else if (viewingIndex! > 0) {
      const prevUser = storyUsers[viewingIndex! - 1]
      setViewingIndex(prev => prev! - 1)
      setViewingStoryIndex(prevUser ? prevUser.stories.length - 1 : 0)
    }
    setShowViewers(false)
  }

  const handleNextStory = () => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    const user = storyUsers[viewingIndex!]
    if (!user) return
    if (viewingStoryIndex < user.stories.length - 1) {
      setViewingStoryIndex(prev => prev + 1)
    } else if (viewingIndex! < storyUsers.length - 1) {
      setViewingIndex(prev => prev! + 1)
      setViewingStoryIndex(0)
    } else {
      setViewingIndex(null)
      setViewingStoryIndex(0)
    }
    setShowViewers(false)
  }

  const handleCreateStory = async () => {
    if (!newStoryContent.trim() && !newStoryFile) return
    setCreating(true)

    let media_url: string | null = null
    if (newStoryFile) {
      const ext = newStoryFile.name.split('.').pop() || 'jpg'
      const filePath = `stories/${currentUserId}/${Date.now()}.${ext}`
      const urlRes = await fetch('/api/storage/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      })
      if (urlRes.ok) {
        const { data: urlData } = await urlRes.json()
        const { error: uploadError } = await supabase.storage
          .from('media')
          .uploadToSignedUrl(filePath, urlData.token, newStoryFile)
        if (!uploadError) {
          const { data: pubUrl } = supabase.storage.from('media').getPublicUrl(filePath)
          media_url = pubUrl.publicUrl
        }
      }
    }

    const res = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_url,
        content: newStoryContent.trim() || null,
      }),
    })

    setCreating(false)
    if (res.ok) {
      setShowCreateModal(false)
      setNewStoryContent('')
      setNewStoryFile(null)
      loadStories()
    } else {
      const data = await res.json()
      alert(data.error || 'Erro ao criar estado')
    }
  }

  const handleDeleteStory = async (storyId: string) => {
    if (!confirm('Eliminar este estado?')) return
    setDeletingId(storyId)
    const res = await fetch(`/api/stories/${storyId}`, { method: 'DELETE' })
    setDeletingId(null)
    if (res.ok) {
      loadStories()
      setViewingIndex(null)
      setViewingStoryIndex(0)
      setShowViewers(false)
    }
  }

  const handleOpenViewers = async () => {
    const story = storyUsers[viewingIndex!]?.stories[viewingStoryIndex]
    if (!story) return
    setLoadingViewers(true)
    setShowViewers(true)
    const res = await fetch(`/api/stories/${story.id}/views`)
    if (res.ok) {
      setViewers(await res.json())
    }
    setLoadingViewers(false)
  }

  const closeViewer = () => {
    setViewingIndex(null)
    setViewingStoryIndex(0)
    setShowViewers(false)
  }

  const getViewCount = (story: StoryItem): number => {
    return story.story_views?.[0]?.count || 0
  }

  return (
    <>
      {/* Stories Bar */}
      <div className="flex gap-3 overflow-x-auto py-3 px-1 scrollbar-thin">
        {loading ? (
          <div className="flex gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16">
                <div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse" />
                <div className="w-12 h-2 bg-gray-200 animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {currentUserId && (
              <button
                onClick={async () => {
                  const ownIdx = storyUsers.findIndex(u => u.id === currentUserId)
                  if (ownIdx >= 0) {
                    setViewingIndex(ownIdx)
                    setViewingStoryIndex(0)
                  } else {
                    const ready = await checkProfileReady()
                    if (ready) setShowCreateModal(true)
                  }
                }}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16 group"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-white shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all">
                  <Plus size={24} />
                </div>
                <span className="text-[10px] font-bold text-gray-400 truncate w-full text-center">O teu estado</span>
              </button>
            )}
            {storyUsers
              .filter(u => u.id !== currentUserId)
              .map((user) => {
                const isAdmin = user.email?.toLowerCase() === 'superadmin.xoxo@gmail.com'
                return (
                <button
                  key={user.id}
                  onClick={() => {
                    const idx = storyUsers.findIndex(u => u.id === user.id)
                    setViewingIndex(idx)
                    setViewingStoryIndex(0)
                  }}
                  className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16 group"
                >
                  <div className={`relative w-16 h-16 rounded-full p-[3px] shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all ${isAdmin ? 'bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-500 shadow-amber-400/40' : 'bg-gradient-to-br from-accent to-purple-500'}`}>
                    <div className="w-full h-full rounded-full bg-white overflow-hidden">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-600 font-bold text-lg">
                          {user.display_name?.charAt(0)}
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="absolute -bottom-0.5 -right-0.5 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full p-0.5 shadow-md shadow-amber-500/50 ring-2 ring-white">
                        <Crown size={12} className="text-white" />
                      </div>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold truncate w-full text-center dark:text-gray-400 ${isAdmin ? 'text-amber-600' : 'text-gray-500'}`}>
                    {user.display_name?.split(' ')[0]}
                  </span>
                </button>
              )})}
          </>
        )}
      </div>

      {/* Story Viewer */}
      {viewingIndex !== null && storyUsers[viewingIndex] && (
        <div
          className="fixed inset-0 z-[100] bg-black flex flex-col"
          onClick={(e) => { if (e.target === e.currentTarget) closeViewer() }}
        >
          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 z-20 flex gap-0.5 px-1 pt-1">
            {storyUsers[viewingIndex].stories.map((story, i) => (
              <div key={story.id} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-75"
                  style={{
                    width: i < viewingStoryIndex ? '100%' : i === viewingStoryIndex ? `${progressRef.current}%` : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Top bar */}
          <div className="absolute top-2 left-0 right-0 z-20 flex items-center justify-between px-3 pt-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/50 flex-shrink-0 shadow-lg">
                {storyUsers[viewingIndex].avatar_url ? (
                  <img src={storyUsers[viewingIndex].avatar_url} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm bg-gray-600">
                    {storyUsers[viewingIndex].display_name?.charAt(0)}
                  </div>
                )}
              </div>
              <div>
                <p className="text-white font-bold text-sm drop-shadow-lg leading-tight">{storyUsers[viewingIndex].display_name}</p>
                <p className="text-white/60 text-[10px] font-medium">
                  {formatRelativeTime(storyUsers[viewingIndex].stories[viewingStoryIndex]?.created_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {storyUsers[viewingIndex].id === currentUserId && (
                <button
                  onClick={handleOpenViewers}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-bold hover:bg-white/25 transition-all backdrop-blur-sm"
                >
                  <Eye size={14} />
                  {getViewCount(storyUsers[viewingIndex].stories[viewingStoryIndex])}
                </button>
              )}
              {storyUsers[viewingIndex].id === currentUserId && (
                <button
                  onClick={async () => { const ready = await checkProfileReady(); if (ready) { closeViewer(); setTimeout(() => setShowCreateModal(true), 100) } }}
                  className="p-1.5 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors backdrop-blur-sm"
                >
                  <Plus size={16} />
                </button>
              )}
              {storyUsers[viewingIndex].id === currentUserId && (
                <button
                  onClick={() => handleDeleteStory(storyUsers[viewingIndex].stories[viewingStoryIndex]?.id)}
                  disabled={deletingId !== null}
                  className="p-1.5 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors disabled:opacity-50 backdrop-blur-sm"
                >
                  {deletingId ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                </button>
              )}
              <button
                onClick={closeViewer}
                className="p-1.5 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors backdrop-blur-sm"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 relative flex items-center justify-center">
            {/* Left tap area */}
            <div className="absolute left-0 top-0 bottom-0 w-1/3 z-10" onClick={(e) => { e.stopPropagation(); handlePrevStory() }} />
            {/* Right tap area */}
            <div className="absolute right-0 top-0 bottom-0 w-1/3 z-10" onClick={(e) => { e.stopPropagation(); handleNextStory() }} />
            {/* Center tap / content */}
            {storyUsers[viewingIndex].stories[viewingStoryIndex]?.media_url ? (
              <div className="w-full h-full flex items-center justify-center">
                <img
                  src={storyUsers[viewingIndex].stories[viewingStoryIndex].media_url}
                  alt="Story"
                  className="max-w-full max-h-full object-contain"
                  onClick={(e) => { e.stopPropagation(); handleNextStory() }}
                />
              </div>
            ) : (
              <div
                className="text-white text-2xl font-bold text-center px-8 max-w-lg"
                onClick={(e) => { e.stopPropagation(); handleNextStory() }}
              >
                {storyUsers[viewingIndex].stories[viewingStoryIndex]?.content}
              </div>
            )}
          </div>

          {/* Bottom gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/60 to-transparent z-10 pointer-events-none" />

          {/* Viewers Panel */}
          {showViewers && (
            <div
              className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={(e) => { if (e.target === e.currentTarget) setShowViewers(false) }}
            >
              <div className="bg-gray-900 rounded-2xl w-full max-w-sm mx-4 max-h-[60vh] overflow-hidden shadow-2xl border border-white/10">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <button onClick={() => setShowViewers(false)} className="text-white/60 hover:text-white transition-colors">
                    <ChevronLeft size={20} />
                  </button>
                  <h3 className="text-white font-bold text-sm">Visualizações</h3>
                  <div className="w-5" />
                </div>
                <div className="overflow-y-auto max-h-[50vh] p-2">
                  {loadingViewers ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={20} className="animate-spin text-white/40" />
                    </div>
                  ) : viewers.length === 0 ? (
                    <p className="text-white/40 text-sm text-center py-8 font-medium">Ninguém viu ainda</p>
                  ) : (
                    viewers.map((v) => (
                      <div key={v.user_id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl transition-colors">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                          {v.profiles?.avatar_url ? (
                            <img src={v.profiles.avatar_url} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/60 text-xs font-bold">
                              {v.profiles?.display_name?.charAt(0) || '?'}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{v.profiles?.display_name || 'Usuário'}</p>
                          <p className="text-white/40 text-[10px]">{formatRelativeTime(v.created_at)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Story Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false) }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-lg">Criar Estado</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <textarea
                placeholder="O que estás a pensar?"
                value={newStoryContent}
                onChange={(e) => setNewStoryContent(e.target.value)}
                className="w-full h-24 rounded-xl border border-border p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-accent/20 dark:bg-gray-700 dark:text-white"
                maxLength={200}
              />

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium">
                  <ImageIcon size={18} className="text-accent" />
                  Adicionar Foto
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setNewStoryFile(e.target.files?.[0] || null)}
                  />
                </label>
                {newStoryFile && (
                  <span className="text-xs text-gray-500 truncate flex-1">{newStoryFile.name}</span>
                )}
              </div>

              <button
                onClick={handleCreateStory}
                disabled={(!newStoryContent.trim() && !newStoryFile) || creating}
                className="w-full py-3 rounded-xl bg-accent text-white font-bold flex items-center justify-center gap-2 hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {creating ? <Loader2 size={18} className="animate-spin" /> : <><Send size={18} /> Publicar Estado</>}
              </button>
            </div>

            <p className="text-[10px] text-gray-400 text-center mt-4 font-medium">
              O estado desaparece após 24 horas
            </p>
          </div>
        </div>
      )}
    </>
  )
}
