'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, X, Send, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'

export default function FeedbackModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [showButton, setShowButton] = useState(true)
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    // Check if user dismissed the button
    const dismissed = localStorage.getItem('feedbackButtonDismissed')
    if (dismissed) {
      setShowButton(false)
    }

    // Reset on authentication
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Reset dismissed state when user authenticates
        localStorage.removeItem('feedbackButtonDismissed')
        setShowButton(true)
      }
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        localStorage.removeItem('feedbackButtonDismissed')
        setShowButton(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleDismiss = () => {
    localStorage.setItem('feedbackButtonDismissed', 'true')
    setShowButton(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (rating === 0 || !message.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, selecione uma avaliação e escreva uma mensagem.",
        variant: "destructive"
      })
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado para enviar feedback.",
          variant: "destructive"
        })
        return
      }

      setSubmitting(true)

      const { error } = await supabase.from('feedbacks').insert({
        user_id: user.id,
        rating,
        message: message.trim(),
        created_at: new Date().toISOString()
      })

      if (error) throw error

      toast({
        title: "Feedback enviado!",
        description: "Obrigado pelo seu feedback. Nós valorizamos a sua opinião.",
      })

      setRating(0)
      setMessage('')
      setIsOpen(false)
    } catch (err) {
      console.error('Error submitting feedback:', err)
      toast({
        title: "Erro",
        description: "Não foi possível enviar o feedback. Tente novamente.",
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && showButton && (
        <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2">
          <button
            onClick={handleDismiss}
            className="bg-white hover:bg-gray-100 text-gray-600 w-8 h-8 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
            title="Dispensar"
          >
            <X size={16} />
          </button>
          <button
            onClick={() => setIsOpen(true)}
            className="bg-accent hover:bg-accent/90 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 animate-bounce"
            title="Enviar Feedback"
          >
            <MessageCircle size={24} />
          </button>
        </div>
      )}

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[1000000] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in duration-300 relative z-[1000001]">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <MessageCircle className="text-accent" size={20} />
                  Enviar Feedback
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Como você avalia a plataforma?
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        size={32}
                        className={`${
                          star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                        } transition-colors`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  Sua mensagem
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Conte-nos sobre sua experiência, sugestões ou problemas que encontrou..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all resize-none"
                  rows={4}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Enviar Feedback
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
