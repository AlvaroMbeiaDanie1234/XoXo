'use client'

import { useState, useRef } from 'react'
import { X, Image as ImageIcon, Video, Calendar, FileText, Settings, DollarSign, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface CreatePostModalProps {
  isOpen: boolean
  onClose: () => void
  user: any
}

export default function CreatePostModal({ isOpen, onClose, user }: CreatePostModalProps) {
  const [content, setContent] = useState('')
  const [price, setPrice] = useState('')
  const [isPaid, setIsPaid] = useState(false)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  if (!isOpen) return null

  const resetState = () => {
    setContent('')
    setPrice('')
    setIsPaid(false)
    setMediaFile(null)
    setMediaPreview(null)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        alert('O ficheiro é demasiado grande. Por favor escolha um ficheiro menor que 100MB.')
        return
      }
      setMediaFile(file)
      const url = URL.createObjectURL(file)
      setMediaPreview(url)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() && !mediaFile) return
    
    setIsSubmitting(true)
    
    try {
      let mediaUrl = ''
      let mediaType: 'photo' | 'video' | 'article' = 'article'

      if (mediaFile) {
        mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'photo'
        
        // Use a unique file name
        const fileExt = mediaFile.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${user.id}/${fileName}`

        // 1. Get signed upload URL to bypass RLS limits on the client
        const res = await fetch('/api/storage/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath })
        })
        
        const { data: signedData, error: signedError } = await res.json()
        if (signedError || !signedData) throw new Error(signedError || "Falha ao gerar permissão de upload.")

        // 2. Upload directly to Supabase using the signed URL
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('media')
          .uploadToSignedUrl(filePath, signedData.token, mediaFile)

        if (uploadError) {
          console.error("Storage upload error:", uploadError)
          throw new Error("Falha ao fazer upload do ficheiro. Verifique a sua conexão.")
        }

        const { data: publicUrlData } = supabase.storage
          .from('media')
          .getPublicUrl(filePath)
          
        mediaUrl = publicUrlData.publicUrl
      }

      const publishRes = await fetch('/api/posts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: content.split('\n')[0] || 'Nova Publicação',
          description: content,
          content_type: mediaType,
          thumbnail_url: mediaUrl || 'https://images.unsplash.com/photo-1633356122544-f134ef2944f1?w=600&h=400&fit=crop',
          content_url: mediaUrl,
          price: parseFloat(price) || 0,
          is_free: !isPaid,
        }),
      })

      const publishData = await publishRes.json()
      if (!publishRes.ok) {
        if (publishData.error === 'DEPOSIT_REQUIRED') {
          alert(publishData.message)
          router.push('/dashboard?mode=wallet&view=deposit&required=1')
          return
        }
        throw new Error(publishData.message || publishData.error || 'Erro ao publicar')
      }
      
      console.log('Published successfully')
      handleClose()
      window.location.reload() // Força atualização completa do feed
    } catch (err: any) {
      console.error('Error publishing:', err)
      alert('Erro ao publicar: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[600px] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Criar publicação</h2>
          <button onClick={handleClose} disabled={isSubmitting} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content Area */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="p-4 flex-1">
            {/* User Info */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white font-bold text-lg">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <p className="font-semibold text-foreground">{user?.email || 'Membro'}</p>
                <button type="button" className="flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full mt-1">
                  Qualquer pessoa <Settings size={12} className="ml-1" />
                </button>
              </div>
            </div>

            {/* Text Input */}
            <textarea
              placeholder="No que está a pensar?"
              className="w-full h-24 resize-none outline-none text-lg text-foreground placeholder-gray-500 bg-transparent"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSubmitting}
            />

            {/* Media Preview */}
            {mediaPreview && (
              <div className="relative mt-4 rounded-lg overflow-hidden border border-border bg-black max-h-[300px] flex items-center justify-center">
                <button 
                  type="button"
                  onClick={() => {
                    setMediaFile(null)
                    setMediaPreview(null)
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-black/70 text-white rounded-full hover:bg-black/90 z-10"
                >
                  <X size={16} />
                </button>
                {mediaFile?.type.startsWith('video/') ? (
                  <video src={mediaPreview} controls className="max-h-[300px] w-full object-contain" />
                ) : (
                  <img src={mediaPreview} alt="Preview" className="max-h-[300px] w-full object-contain" />
                )}
              </div>
            )}

            {/* Price / Monetization Toggle */}
            <div className="mt-4 p-4 border border-border rounded-lg bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <DollarSign size={20} className="text-green-600" />
                  Conteúdo Pago?
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                </label>
              </div>
              
              {isPaid && (
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-sm font-medium text-gray-600">Preço:</span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">AOA</span>
                    <input 
                      type="number" 
                      placeholder="0,00" 
                      className="w-full pl-12 pr-4 py-2 bg-white border border-border rounded-md outline-none focus:border-accent transition-colors"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      required={isPaid}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-border mt-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  accept="image/*,video/*" 
                  className="hidden" 
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="p-3 text-gray-500 hover:bg-gray-100 rounded-full transition-colors relative group disabled:opacity-50"
                >
                  <ImageIcon size={24} className="text-blue-500" />
                </button>
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="p-3 text-gray-500 hover:bg-gray-100 rounded-full transition-colors relative group disabled:opacity-50"
                >
                  <Video size={24} className="text-green-600" />
                </button>
                <button type="button" disabled={isSubmitting} className="p-3 text-gray-500 hover:bg-gray-100 rounded-full transition-colors relative group disabled:opacity-50">
                  <Calendar size={24} className="text-orange-500" />
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button 
                type="submit" 
                disabled={(!content.trim() && !mediaFile) || isSubmitting}
                className="bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-2 rounded-full transition-colors flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Publicando...
                  </>
                ) : 'Publicar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
