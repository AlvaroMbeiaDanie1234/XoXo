'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { Camera, Video, VideoOff, Mic, MicOff, Send, DollarSign, Users, X } from 'lucide-react'
import LiveKitStream from '@/components/dashboard/LiveKitStream'

export default function StreamPage() {
  const { toast } = useToast()
  const supabase = createClient()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [title, setTitle] = useState('')
  const [isPaid, setIsPaid] = useState(false)
  const [price, setPrice] = useState('')
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isMicOn, setIsMicOn] = useState(true)
  const [viewerCount, setViewerCount] = useState(0)
  const [messages, setMessages] = useState<any[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [tipAmount, setTipAmount] = useState('')
  const [showTipModal, setShowTipModal] = useState(false)
  const [currentLiveId, setCurrentLiveId] = useState<string | null>(null)
  const [liveKitToken, setLiveKitToken] = useState<string | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
    }
    loadUser()
  }, [supabase])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleStartCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setIsCameraOn(true)
    } catch (error) {
      toast({
        title: "Erro ao acessar câmera",
        description: "Verifique se você concedeu permissão para acessar a câmera e microfone.",
        variant: "destructive"
      })
    }
  }

  const handleStopCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraOn(false)
  }

  const handleToggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMicOn(audioTrack.enabled)
      }
    }
  }

  const handleGoLive = async () => {
    if (!title) {
      toast({
        title: "Título obrigatório",
        description: "Por favor, insira um título para a live.",
        variant: "destructive"
      })
      return
    }

    if (!currentUser) {
      toast({
        title: "Não autenticado",
        description: "Faça login para iniciar uma live.",
        variant: "destructive"
      })
      return
    }

    try {
      const { data: liveData, error } = await supabase
        .from('lives')
        .insert({
          creator_id: currentUser.id,
          title,
          is_paid: isPaid,
          price: isPaid ? parseFloat(price) : 0,
          status: 'live',
          thumbnail_url: '/live.mp4'
        })
        .select()
        .single()

      if (error) throw error

      setCurrentLiveId(liveData.id)
      setIsStreaming(true)
      
      // Generate LiveKit token
      const tokenResponse = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: liveData.id,
          participantName: currentUser.email || currentUser.id,
          isHost: true
        })
      })
      
      const { token } = await tokenResponse.json()
      setLiveKitToken(token)
      
      // Subscribe to live messages
      const channel = supabase
        .channel(`live:${liveData.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'live_messages',
          filter: `live_id=eq.${liveData.id}`
        }, (payload) => {
          setMessages(prev => [...prev, payload.new])
        })
        .subscribe()

      toast({
        title: "Live iniciada!",
        description: "Sua live está ao vivo agora."
      })
    } catch (error) {
      toast({
        title: "Erro ao iniciar live",
        description: "Não foi possível iniciar a live. Tente novamente.",
        variant: "destructive"
      })
    }
  }

  const handleEndLive = async () => {
    try {
      await supabase
        .from('lives')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('creator_id', currentUser.id)
        .eq('status', 'live')

      setIsStreaming(false)
      handleStopCamera()
      toast({
        title: "Live encerrada",
        description: "Sua live foi encerrada com sucesso."
      })
    } catch (error) {
      toast({
        title: "Erro ao encerrar live",
        description: "Não foi possível encerrar a live.",
        variant: "destructive"
      })
    }
  }

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return
    if (!currentLiveId) return

    try {
      await supabase
        .from('live_messages')
        .insert({
          live_id: currentLiveId,
          user_id: currentUser?.id,
          username: currentUser?.email || 'Anônimo',
          message: messageInput
        })

      setMessageInput('')
    } catch (error) {
      toast({
        title: "Erro ao enviar mensagem",
        description: "Não foi possível enviar a mensagem.",
        variant: "destructive"
      })
    }
  }

  const handleSendTip = async () => {
    if (!tipAmount || parseFloat(tipAmount) < 500) {
      toast({
        title: "Valor mínimo",
        description: "O mínimo de gorjeta é 500 AOA.",
        variant: "destructive"
      })
      return
    }

    try {
      await fetch('/api/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(tipAmount),
          recipient_id: currentUser?.id,
          type: 'live'
        })
      })

      toast({
        title: "Gorjeta enviada!",
        description: `Você enviou ${tipAmount} AOA de gorjeta.`
      })
      
      setTipAmount('')
      setShowTipModal(false)
    } catch (error) {
      toast({
        title: "Erro ao enviar gorjeta",
        description: "Não foi possível enviar a gorjeta.",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">XoXo Live</h1>
        <div className="flex items-center gap-2">
          <Users size={20} className="text-gray-600" />
          <span className="font-bold">{viewerCount}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-2 md:p-4">
        {!isStreaming ? (
          /* Setup Screen */
          <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 max-w-2xl mx-auto w-full">
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Iniciar Nova Live</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Título da Live</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Digite o título da sua live..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Live</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => { setIsPaid(false); setPrice('') }}
                    className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all ${!isPaid ? 'bg-accent text-white' : 'bg-gray-100 text-gray-700'}`}
                  >
                    Grátis
                  </button>
                  <button
                    onClick={() => setIsPaid(true)}
                    className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all ${isPaid ? 'bg-accent text-white' : 'bg-gray-100 text-gray-700'}`}
                  >
                    Paga
                  </button>
                </div>
              </div>

              {isPaid && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Preço (AOA)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Digite o preço..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              )}

              {!isCameraOn ? (
                <button
                  onClick={handleStartCamera}
                  className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Camera size={24} />
                  Iniciar Câmera
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleStopCamera}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <VideoOff size={18} />
                      Parar
                    </button>
                    <button
                      onClick={handleToggleMic}
                      className={`font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm ${isMicOn ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                    >
                      {isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
                      {isMicOn ? 'Mic' : 'Sem Áudio'}
                    </button>
                  </div>

                  <button
                    onClick={handleGoLive}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 md:py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm md:text-base"
                  >
                    <Video size={20} className="md:size-24" />
                    Inicializar a stream
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Live Screen */
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="relative bg-black aspect-video md:aspect-video">
                {liveKitToken && currentLiveId ? (
                  <LiveKitStream
                    roomName={currentLiveId}
                    participantName={currentUser?.email || currentUser?.id || 'host'}
                    isHost={true}
                    token={liveKitToken}
                    onLeave={handleEndLive}
                  />
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  AO VIVO
                </div>
                <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                  <Users size={16} />
                  {viewerCount}
                </div>
              </div>

              <div className="p-4 flex items-center justify-between border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-bold">{title}</h2>
                  <p className="text-sm text-gray-500">
                    {isPaid ? `AOA ${price}` : 'Grátis'}
                  </p>
                </div>
                <button
                  onClick={handleEndLive}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2 rounded-xl transition-all"
                >
                  Encerrar Live
                </button>
              </div>

              {/* Chat */}
              <div className="p-4">
                <div className="h-64 overflow-y-auto mb-4 space-y-2">
                  {messages.map((msg) => (
                    <div key={msg.id} className="bg-gray-100 rounded-lg p-3">
                      <p className="text-xs font-bold text-gray-700">{msg.username || msg.user}</p>
                      <p className="text-sm text-gray-900">{msg.message || msg.text}</p>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Enviar mensagem..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-accent hover:bg-accent/90 text-white font-bold px-6 py-3 rounded-xl transition-all"
                  >
                    <Send size={20} />
                  </button>
                  <button
                    onClick={() => setShowTipModal(true)}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2"
                  >
                    <DollarSign size={20} />
                    Gorjeta
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tip Modal */}
        {showTipModal && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Enviar Gorjeta</h3>
                <button onClick={() => setShowTipModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">Mínimo: 500 AOA</p>
              <input
                type="number"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                placeholder="Digite o valor..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent mb-4"
              />
              <button
                onClick={handleSendTip}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-all"
              >
                Enviar Gorjeta
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
