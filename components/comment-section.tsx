'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { formatRelativeTime } from '@/lib/format-relative-time'

interface Comment {
  id: string
  content: string
  created_at: string
  user_id: string
  profiles?: {
    display_name: string
    avatar_url: string | null
  }
}

interface CommentSectionProps {
  postId: string
  userId: string
}

export default function CommentSection({ postId, userId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Initial load of comments
    fetchComments()

    // Set up realtime subscription for new comments on this post
    const commentChannel = supabase
      .channel(`public:comments:post=${postId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
        (payload) => {
          const newComment = payload.new as any
          // Prepend the new comment to the list
          setComments((prev) => [newComment, ...prev])
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(commentChannel)
    }
  }, [postId, supabase])

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*, profiles(display_name, avatar_url)')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setComments(data || [])
    } catch (err) {
      console.error('Error fetching comments:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          content: newComment,
          post_id: postId,
          user_id: userId,
        })
        .select('*, profiles(display_name, avatar_url)')
        .single()

      if (error) throw error
      // Prepend the new comment with profile data to the list
      setComments((prev) => [data, ...prev])
      setNewComment('')
    } catch (err) {
      console.error('Error submitting comment:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-6 border-t border-border pt-8">
      <h2 className="text-2xl font-bold text-foreground">Comentários</h2>

      {/* Comment Form */}
      <form onSubmit={handleSubmitComment} className="space-y-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Deixe seu comentário..."
          className="w-full px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          rows={3}
        />
        <button
          type="submit"
          disabled={submitting || !newComment.trim()}
          className="px-4 py-2 rounded-lg bg-accent text-accent-foreground font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Enviando...' : 'Comentar'}
        </button>
      </form>

      {/* Comments List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-1/4"></div>
              <div className="h-4 bg-muted rounded w-full"></div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Seja o primeiro a comentar!</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="space-y-2">
              {/* Comment Header */}
              {comment.profiles && (
                <div className="flex items-center gap-2">
                  {comment.profiles.avatar_url ? (
                    <Image
                      src={comment.profiles.avatar_url}
                      alt={comment.profiles.display_name}
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs">
                      {comment.profiles.display_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-sm text-foreground">
                      {comment.profiles.display_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(comment.created_at)}
                    </p>
                  </div>
                </div>
              )}

              {/* Comment Content */}
              <p className="text-foreground bg-muted px-4 py-3 rounded-lg">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
