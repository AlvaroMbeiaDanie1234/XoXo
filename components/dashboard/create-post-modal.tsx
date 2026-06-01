'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Image as ImageIcon, Video, Calendar, Settings, DollarSign, Loader2, Circle, Square, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [profileReady, setProfileReady] = useState<boolean | null>(null)
  const [checkingProfile, setCheckingProfile] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const liveVideoRef = useRef<HTMLVideoElement>(null)
  const playbackVideoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const supabase = createClient()
  const router = useRouter()

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraStream(null)
    setCameraReady(false)
  }

  const clearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview)
    setMediaFile(null)
    setMediaPreview(null)
    stopCamera()
    setIsRecording(false)
    setRecordingSeconds(0)
    setCameraReady(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  useEffect(() => {
    if (!isOpen) {
      clearMedia()
      return
    }
    setCheckingProfile(true)
    setProfileReady(null)
    supabase.from('profiles').select('phone, avatar_url').eq('id', user.id).single().then(({ data }) => {
      setProfileReady(!!(data?.phone && data?.avatar_url))
      setCheckingProfile(false)
    }).catch(() => {
      setProfileReady(false)
      setCheckingProfile(false)
    })
    return () => {
      stopCamera()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isOpen])

  useEffect(() => {
    if (isRecording && recordingSeconds >= 180) {
      stopRecording()
      alert('Gravação limitada a 3 minutos.')
    }
  }, [isRecording, recordingSeconds])

  // Liga o stream à pré-visualização depois do <video> estar no DOM
  useEffect(() => {
    const video = liveVideoRef.current
    if (!isRecording || !cameraStream || !video) return

    setCameraReady(false)
    video.srcObject = cameraStream
    video.muted = true
    video.playsInline = true

    const onReady = () => setCameraReady(true)
    video.addEventListener('loadedmetadata', onReady)
    video.addEventListener('canplay', onReady)

    video.play().catch(() => {})

    return () => {
      video.removeEventListener('loadedmetadata', onReady)
      video.removeEventListener('canplay', onReady)
    }
  }, [isRecording, cameraStream])

  if (!isOpen) return null

  const resetState = () => {
    setContent('')
    setPrice('')
    setIsPaid(false)
    clearMedia()
  }

  const handleClose = () => {
    if (isRecording) stopRecording()
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
      clearMedia()
      setMediaFile(file)
      setMediaPreview(URL.createObjectURL(file))
    }
    e.target.value = ''
  }

  const startRecording = async () => {
    try {
      if (mediaPreview) URL.revokeObjectURL(mediaPreview)
      setMediaFile(null)
      setMediaPreview(null)
      stopCamera()

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      })
      streamRef.current = stream
      setCameraStream(stream)
      setIsRecording(true)
      setRecordingSeconds(0)

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const ext = mimeType.includes('webm') ? 'webm' : 'mp4'
        const file = new File([blob], `gravacao-${Date.now()}.${ext}`, { type: blob.type || mimeType })
        const previewUrl = URL.createObjectURL(blob)
        setMediaFile(file)
        setMediaPreview(previewUrl)
        stopCamera()
        setIsRecording(false)
        setCameraStream(null)
        if (timerRef.current) clearInterval(timerRef.current)
      }

      recorder.start(250)
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1)
      }, 1000)
    } catch {
      alert('Não foi possível aceder à câmara. Verifica as permissões do navegador.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isRecording) stopRecording()
    if (!content.trim() && !mediaFile) return

    setIsSubmitting(true)

    try {
      let mediaUrl = ''
      let mediaType: 'photo' | 'video' | 'article' = 'article'

      if (mediaFile) {
        mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'photo'

        const fileExt = mediaFile.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${user.id}/${fileName}`

        const res = await fetch('/api/storage/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath }),
        })

        const { data: signedData, error: signedError } = await res.json()
        if (signedError || !signedData) throw new Error(signedError || 'Falha ao gerar permissão de upload.')

        const { error: uploadError } = await supabase.storage
          .from('media')
          .uploadToSignedUrl(filePath, signedData.token, mediaFile)

        if (uploadError) {
          throw new Error('Falha ao fazer upload do ficheiro. Verifique a sua conexão.')
        }

        const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(filePath)
        mediaUrl = publicUrlData.publicUrl
      }

      const publishRes = await fetch('/api/posts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: content.split('\n')[0] || 'Nova Publicação',
          description: content,
          content_type: mediaType,
          thumbnail_url: mediaUrl,
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

      handleClose()
      window.location.reload()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      alert('Erro ao publicar: ' + message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 animate-in fade-in duration-200 sm:items-center sm:p-4">
      <div className="flex h-[100dvh] max-h-[100dvh] w-full flex-col rounded-none border-border bg-white shadow-xl sm:h-auto sm:max-h-[90vh] sm:max-w-[600px] sm:rounded-xl sm:border dark:border-gray-800 dark:bg-gray-950">
        <div className="flex shrink-0 items-center justify-between border-b border-border p-4 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-foreground">Criar publicação</h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          {checkingProfile ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-accent" />
            </div>
          ) : profileReady === false ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <AlertTriangle size={32} className="text-amber-500" />
              </div>
              <h3 className="text-lg font-bold mb-2">Perfil incompleto</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
                Para publicar conteúdos, precisas de adicionar um número de telefone e uma foto de perfil.
              </p>
              <Link
                href="/dashboard/profile"
                onClick={handleClose}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent text-white font-bold hover:bg-accent/90 transition-colors"
              >
                Editar Perfil
              </Link>
            </div>
          ) : (
          <>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white font-bold text-lg">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <p className="font-semibold text-foreground">{user?.email || 'Membro'}</p>
                <button
                  type="button"
                  className="mt-1 flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300"
                >
                  Qualquer pessoa <Settings size={12} className="ml-1" />
                </button>
              </div>
            </div>

            <textarea
              placeholder="No que está a pensar?"
              className="h-32 w-full resize-none bg-transparent text-lg text-foreground outline-none placeholder:text-gray-500 dark:placeholder:text-gray-500 sm:h-24"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSubmitting}
            />

            {/* Live camera while recording */}
            {isRecording && (
              <div className="relative mt-4 min-h-[220px] overflow-hidden rounded-lg border-2 border-red-500 bg-gray-900">
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-900">
                    <Loader2 className="animate-spin text-white/80" size={32} />
                  </div>
                )}
                <video
                  ref={liveVideoRef}
                  className="w-full max-h-[300px] min-h-[220px] object-cover video-mirror bg-gray-900"
                  autoPlay
                  playsInline
                  muted
                />
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full z-20">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  REC {formatTime(recordingSeconds)}
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-red-600 shadow-lg hover:bg-red-50 sm:px-5"
                >
                  <Square size={16} fill="currentColor" />
                  Parar gravação
                </button>
              </div>
            )}

            {/* Recorded / uploaded preview */}
            {mediaPreview && !isRecording && (
              <div className="relative mt-4 flex max-h-[45dvh] items-center justify-center overflow-hidden rounded-lg border border-border bg-black sm:max-h-[300px] dark:border-gray-800">
                <button
                  type="button"
                  onClick={clearMedia}
                  className="absolute top-2 right-2 p-1.5 bg-black/70 text-white rounded-full hover:bg-black/90 z-10"
                >
                  <X size={16} />
                </button>
                {mediaFile?.type.startsWith('video/') ? (
                  <video
                    key={mediaPreview}
                    ref={playbackVideoRef}
                    src={mediaPreview}
                    controls
                    preload="auto"
                    playsInline
                    className="max-h-[45dvh] w-full bg-black object-contain sm:max-h-[300px]"
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget
                      v.currentTime = 0.01
                    }}
                  />
                ) : (
                  <img src={mediaPreview} alt="Preview" className="max-h-[45dvh] w-full object-contain sm:max-h-[300px]" />
                )}
              </div>
            )}

            <div className="mt-4 rounded-lg border border-border bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/70">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <DollarSign size={20} className="text-green-600" />
                  Conteúdo Pago?
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isPaid}
                    onChange={(e) => setIsPaid(e.target.checked)}
                  />
                  <div className="peer h-6 w-11 rounded-full bg-gray-300 peer-checked:bg-accent peer-focus:outline-none after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-gray-700" />
                </label>
              </div>

              {isPaid && (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Preço:</span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium dark:text-gray-400">AOA</span>
                    <input
                      type="number"
                      placeholder="0,00"
                      className="w-full rounded-md border border-border bg-white py-2 pl-12 pr-4 text-foreground outline-none transition-colors placeholder:text-gray-400 focus:border-accent dark:border-gray-700 dark:bg-gray-950"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      required={isPaid}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto shrink-0 border-t border-border bg-white p-3 dark:border-gray-800 dark:bg-gray-950 sm:p-4">
            <div className="mb-3 flex items-center justify-between sm:mb-4">
              <div className="flex flex-wrap gap-1">
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
                  disabled={isSubmitting || isRecording}
                  className="rounded-full p-3 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-900"
                  title="Carregar foto ou vídeo"
                >
                  <ImageIcon size={24} className="text-blue-500" />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting || isRecording}
                  className="rounded-full p-3 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-900"
                  title="Carregar vídeo"
                >
                  <Video size={24} className="text-green-600" />
                </button>
                {!isRecording && !mediaPreview && (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 rounded-full border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/70 dark:text-red-300 dark:hover:bg-red-950/40 sm:px-4"
                    title="Gravar vídeo com a câmara (até 3 min)"
                  >
                    <Circle size={18} fill="currentColor" />
                    Gravar vídeo
                  </button>
                )}
                <button
                  type="button"
                  disabled={isSubmitting || isRecording}
                  className="rounded-full p-3 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-900"
                >
                  <Calendar size={24} className="text-orange-500" />
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={(!content.trim() && !mediaFile) || isSubmitting || isRecording}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-2.5 font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Publicando...
                  </>
                ) : (
                  'Publicar'
                )}
              </button>
            </div>
            </div>
            </>)}
        </form>
      </div>

    </div>
  )
}
