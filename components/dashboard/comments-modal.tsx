'use client'

import { useState, useEffect } from 'react'
import { X, Send, Reply, Loader2, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface CommentsModalProps {
  isOpen: boolean
  onClose: () => void
  postId: string
  user: any
  content_url?: string
  content_type?: 'video' | 'article' | 'photo'
}

export default function CommentsModal({ isOpen, onClose, postId, user, content_url, content_type }: CommentsModalProps) {
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      fetchComments()
    }
  }, [isOpen, postId])

  const fetchComments = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(display_name, avatar_url, is_verified)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    
    if (data) {
      const rootComments = data.filter(c => !c.parent_id)
      const replies = data.filter(c => c.parent_id)
      const tree = rootComments.map(c => ({
        ...c,
        replies: replies.filter(r => r.parent_id === c.id)
      }))
      setComments(tree)
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newComment.trim()) return
    
    setSubmitting(true)
    try {
      const { error } = await supabase.from('comments').insert({
        post_id: postId,
        user_id: user.id,
        content: newComment,
        parent_id: replyTo?.id || null
      })

      if (error) throw error
      setNewComment('')
      setReplyTo(null)
      fetchComments()
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[550px] flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gray-50">
          <h2 className="text-lg font-bold text-foreground">Comentários</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content Preview */}
        {content_url && (
          <div className="w-full bg-black aspect-video flex-shrink-0 border-b border-border">
            {content_type === 'video' ? (
              <video src={content_url} controls className="w-full h-full object-contain" />
            ) : (
              <img src={content_url} className="w-full h-full object-contain" />
            )}
          </div>
        )}

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-accent" /></div>
          ) : comments.length > 0 ? (
            comments.map((comment) => (
              <div key={comment.id} className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-muted flex-shrink-0">
                    {comment.profiles?.avatar_url && <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1">
                    <div className="bg-[#f2f3f5] p-3 rounded-2xl">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="font-bold text-xs">{comment.profiles?.display_name}</span>
                        {comment.profiles?.is_verified && <CheckCircle size={10} className="text-blue-500 fill-blue-500" />}
                      </div>
                      <p className="text-sm text-gray-800">{comment.content}</p>
                    </div>
                    <div className="flex items-center gap-4 mt-1 ml-2">
                      <button onClick={() => setReplyTo(comment)} className="text-[10px] font-bold text-gray-500 hover:underline">Responder</button>
                      <span className="text-[9px] text-gray-400 uppercase">{new Date(comment.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Replies */}
                {comment.replies?.map((reply: any) => (
                  <div key={reply.id} className="flex gap-3 ml-12">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      {reply.profiles?.avatar_url && <img src={reply.profiles.avatar_url} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1">
                      <div className="bg-[#f2f3f5] p-2 rounded-xl">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="font-bold text-[11px]">{reply.profiles?.display_name}</span>
                        </div>
                        <p className="text-xs text-gray-700">{reply.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">Ninguém comentou ainda.</div>
          )}
        </div>

        {/* Input Footer */}
        <div className="p-4 border-t border-border bg-white">
          {user ? (
            <form onSubmit={handleSubmit} className="relative">
              {replyTo && (
                <div className="absolute bottom-full left-0 right-0 bg-gray-50 p-2 border-x border-t border-border rounded-t-md flex justify-between items-center text-[10px] text-gray-500">
                  <span>Respondendo a <strong>{replyTo.profiles?.display_name}</strong></span>
                  <button onClick={() => setReplyTo(null)} className="text-red-500">Cancelar</button>
                </div>
              )}
              <div className="flex items-center gap-2 bg-[#f0f2f5] rounded-md px-3 py-1.5 border border-transparent focus-within:border-gray-300 transition-colors">
                <textarea
                  placeholder="Escreve um comentário..."
                  className="flex-1 bg-transparent border-none outline-none text-sm py-1 resize-none h-8 max-h-24 leading-normal"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <button 
                  type="submit" 
                  disabled={submitting || !newComment.trim()} 
                  className="text-accent disabled:opacity-30 p-1"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-center text-gray-500">Faz login para comentar.</p>
          )}
        </div>
      </div>
    </div>
  )
}
