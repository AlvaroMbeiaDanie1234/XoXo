'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Header from '@/components/dashboard/header'
import Sidebar from '@/components/dashboard/sidebar'
import { useToast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import {
  Loader2, Radio, Lock, Unlock, Users, MessageSquare, Send,
  CheckCircle, DollarSign, Play, Camera, Sparkles, Plus, Heart, ArrowLeft, Tv
} from 'lucide-react'
import dynamic from 'next/dynamic'

const ZegoStream = dynamic(() => import('@/components/dashboard/ZegoStream'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-white min-h-[400px]">
      <Loader2 className="animate-spin text-accent" size={32} />
      <span className="ml-2 text-xs font-bold uppercase tracking-wider text-zinc-400">A iniciar transmissão...</span>
    </div>
  )
})


interface Stream {
  id: string
  user_id: string
  title: string
  price: number
  is_free: boolean
  is_active: boolean
  viewer_count: number
  created_at: string
  profiles?: {
    display_name: string
    avatar_url: string
    is_verified: boolean
  }
}

interface ChatComment {
  id: string
  content: string
  user_id: string
  created_at: string
  profiles?: {
    display_name: string
    avatar_url: string
  }
}

export default function LiveStreamPage() {
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Stream lists & status
  const [activeStreams, setActiveStreams] = useState<Stream[]>([])
  const [isCreatorMode, setIsCreatorMode] = useState(false)
  const [currentActiveStream, setCurrentActiveStream] = useState<Stream | null>(null)
  const [purchasedStreamIds, setPurchasedStreamIds] = useState<string[]>([])

  // Setup stream form
  const [streamTitle, setStreamTitle] = useState('')
  const [streamPrice, setStreamPrice] = useState('2000')
  const [isStreamFree, setIsStreamFree] = useState(true)
  const [startingStream, setStartingStream] = useState(false)

  // Watching stream states
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null)
  const [hasAccessToStream, setHasAccessToStream] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(false)
  const [purchasingStream, setPurchasingStream] = useState(false)

  // Chat & Stream stats
  const [chatComments, setChatComments] = useState<ChatComment[]>([])
  const [newCommentText, setNewCommentText] = useState('')
  const [realViewerCount, setRealViewerCount] = useState(0)
  const [liveEarnings, setLiveEarnings] = useState(0)

  // Tip & Interaction States
  const [showTipModal, setShowTipModal] = useState(false)
  const [tipAmount, setTipAmount] = useState('')
  const [sendingTip, setSendingTip] = useState(false)
  const [isSubscribedToCreator, setIsSubscribedToCreator] = useState(false)
  const [showCreatorProfileModal, setShowCreatorProfileModal] = useState(false)

  // Camera feeds
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamTrackRef = useRef<MediaStream | null>(null)

  // WebRTC Signaling & Connection references
  const peerConnectionsRef = useRef<{ [key: string]: RTCPeerConnection }>({})
  const viewerPCRef = useRef<RTCPeerConnection | null>(null)
  const [webRTCStreamActive, setWebRTCStreamActive] = useState(false)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const webRTCActiveRef = useRef(false)

  // Load basic session
  useEffect(() => {
    async function loadSession() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }
        setUser(user)

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        setProfile(profileData)

        // Load purchased streams
        const { data: purchases } = await supabase
          .from('live_stream_purchases')
          .select('stream_id')
          .eq('user_id', user.id)

        if (purchases) {
          setPurchasedStreamIds(purchases.map(p => p.stream_id))
        }

        // Load active streams
        await loadActiveStreams()
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [])

  // Poll for active streams & listen real-time
  useEffect(() => {
    if (!user) return

    const streamsChannel = supabase
      .channel('active_live_streams_channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_streams'
      }, () => {
        loadActiveStreams()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(streamsChannel)
    }
  }, [user])

  // Fetch active streams from DB
  const loadActiveStreams = async () => {
    const { data } = await supabase
      .from('live_streams')
      .select('*, profiles(display_name, avatar_url)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (data) {
      setActiveStreams(data as any[])
    }
  }

  // Handle opening a stream to watch
  const handleSelectStream = async (stream: Stream) => {
    setSelectedStream(stream)
    setChatComments([])
    fetchStreamComments(stream.id)

    // Increment viewer count in database
    try {
      const { data: currentStream } = await supabase
        .from('live_streams')
        .select('viewer_count')
        .eq('id', stream.id)
        .single()

      const newCount = (currentStream?.viewer_count || 0) + 1

      await supabase
        .from('live_streams')
        .update({ viewer_count: newCount })
        .eq('id', stream.id)
    } catch (err) {
      console.error('Error incrementing viewer count:', err)
    }

    if (stream.user_id === user.id) {
      setHasAccessToStream(true)
      return
    }

    if (stream.is_free) {
      setHasAccessToStream(true)
      return
    }

    // Check if purchased
    setCheckingAccess(true)
    try {
      const { data } = await supabase
        .from('live_stream_purchases')
        .select('*')
        .eq('stream_id', stream.id)
        .eq('user_id', user.id)
        .single()

      if (data) {
        setHasAccessToStream(true)
      } else {
        setHasAccessToStream(false)
      }
    } catch (err) {
      setHasAccessToStream(false)
    } finally {
      setCheckingAccess(false)
    }
  }

  // Fetch comments for chosen stream
  const fetchStreamComments = async (streamId: string) => {
    const { data } = await supabase
      .from('live_stream_comments')
      .select('*, profiles(display_name, avatar_url)')
      .eq('stream_id', streamId)
      .order('created_at', { ascending: true })
      .limit(50)

    if (data) {
      setChatComments(data as any[])
    }
  }

  // Listen to new comments, live stream updates, and handle viewer count decrement on tab close
  useEffect(() => {
    if (!selectedStream) return

    // 1. Subscribe to new comments
    const commentsChannel = supabase
      .channel(`live_stream_comments:${selectedStream.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_comments',
        filter: `stream_id=eq.${selectedStream.id}`
      }, async (payload) => {
        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('id', payload.new.user_id)
          .single()

        setChatComments(prev => {
          if (prev.some(c => c.id === payload.new.id)) return prev
          return [
            ...prev,
            {
              ...payload.new,
              profiles: senderProfile || { display_name: 'Usuário', avatar_url: '' }
            }
          ] as ChatComment[]
        })
      })
      .subscribe()

    // 2. Subscribe to live stream updates (like real-time viewer count and active status)
    const streamUpdateChannel = supabase
      .channel(`live_stream_updates:${selectedStream.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_streams',
        filter: `id=eq.${selectedStream.id}`
      }, (payload) => {
        setRealViewerCount(payload.new.viewer_count)

        // If creator ended the stream, gracefully redirect viewers out
        if (payload.new.is_active === false && selectedStream.user_id !== user.id) {
          toast({
            title: "Live Encerrada",
            description: "Esta transmissão foi encerrada pelo criador.",
          })
          setSelectedStream(null)
          setHasAccessToStream(false)
          setRealViewerCount(0)
          setChatComments([])
        }
      })
      .subscribe()

    setRealViewerCount(selectedStream.viewer_count || 1)

    // 3. Decrement on unload or component unmount
    const handleUnload = () => {
      const decrementCount = async () => {
        const { data: currentStream } = await supabase
          .from('live_streams')
          .select('viewer_count')
          .eq('id', selectedStream.id)
          .single()
        const newCount = Math.max(0, (currentStream?.viewer_count || 0) - 1)
        await supabase.from('live_streams').update({ viewer_count: newCount }).eq('id', selectedStream.id)
      }
      decrementCount()
    }

    window.addEventListener('beforeunload', handleUnload)

    return () => {
      supabase.removeChannel(commentsChannel)
      supabase.removeChannel(streamUpdateChannel)
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [selectedStream])

  // WebRTC Real-Time Signaling Mesh Hook
  useEffect(() => {
    if (!selectedStream || !user) return

    const pcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    }

    const signalingChannel = supabase.channel(`webrtc_signaling:${selectedStream.id}`)

    let joinInterval: any = null

    // Listen to signaling messages
    signalingChannel
      .on('broadcast', { event: 'webrtc-msg' }, async ({ payload }) => {
        const { type, sender, target, data } = payload

        // Ignore messages not targeted to me
        if (target !== user.id) return

        if (selectedStream.user_id === user.id) {
          // I am the CREATOR
          if (type === 'join') {
            console.log(`🔌 WebRTC: Viewer joined: ${sender}`)
            // Create a new PeerConnection for this viewer
            const pc = new RTCPeerConnection(pcConfig)
            peerConnectionsRef.current[sender] = pc

            // Add local stream tracks
            if (streamTrackRef.current) {
              streamTrackRef.current.getTracks().forEach(track => {
                pc.addTrack(track, streamTrackRef.current!)
              })
            }

            // ICE Candidate handler
            pc.onicecandidate = (event) => {
              if (event.candidate) {
                signalingChannel.send({
                  type: 'broadcast',
                  event: 'webrtc-msg',
                  payload: {
                    type: 'ice-candidate',
                    sender: user.id,
                    target: sender,
                    data: event.candidate
                  }
                })
              }
            }

            // Create Offer
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)

            // Send Offer to viewer
            signalingChannel.send({
              type: 'broadcast',
              event: 'webrtc-msg',
              payload: {
                type: 'offer',
                sender: user.id,
                target: sender,
                data: offer
              }
            })
          } else if (type === 'answer') {
            console.log(`🔌 WebRTC: Received answer from viewer: ${sender}`)
            const pc = peerConnectionsRef.current[sender]
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription(data))
            }
          } else if (type === 'ice-candidate') {
            const pc = peerConnectionsRef.current[sender]
            if (pc) {
              await pc.addIceCandidate(new RTCIceCandidate(data))
            }
          }
        } else {
          // I am the VIEWER
          if (type === 'offer') {
            console.log("🔌 WebRTC: Received offer from creator")
            // Create PeerConnection
            const pc = new RTCPeerConnection(pcConfig)
            viewerPCRef.current = pc

            // Handle remote track
            pc.ontrack = (event) => {
              console.log("📺 WebRTC: Remote track received successfully!")
              remoteStreamRef.current = event.streams[0]
              setWebRTCStreamActive(true)
            }

            // ICE Candidate handler
            pc.onicecandidate = (event) => {
              if (event.candidate) {
                signalingChannel.send({
                  type: 'broadcast',
                  event: 'webrtc-msg',
                  payload: {
                    type: 'ice-candidate',
                    sender: user.id,
                    target: selectedStream.user_id,
                    data: event.candidate
                  }
                })
              }
            }

            await pc.setRemoteDescription(new RTCSessionDescription(data))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)

            // Send Answer back to creator
            signalingChannel.send({
              type: 'broadcast',
              event: 'webrtc-msg',
              payload: {
                type: 'answer',
                sender: user.id,
                target: selectedStream.user_id,
                data: answer
              }
            })
          } else if (type === 'ice-candidate') {
            const pc = viewerPCRef.current
            if (pc) {
              await pc.addIceCandidate(new RTCIceCandidate(data))
            }
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (selectedStream.user_id !== user.id) {
            console.log("🔌 WebRTC: Viewer sending join broadcast...")
            // Viewer announces presence to trigger WebRTC offer from creator
            signalingChannel.send({
              type: 'broadcast',
              event: 'webrtc-msg',
              payload: {
                type: 'join',
                sender: user.id,
                target: selectedStream.user_id
              }
            })

            // Periodic connection retry every 3s if not yet linked up
            joinInterval = setInterval(() => {
              if (webRTCActiveRef.current) {
                clearInterval(joinInterval)
                return
              }
              console.log("🔌 WebRTC: Connection pending. Retrying join broadcast...")
              signalingChannel.send({
                type: 'broadcast',
                event: 'webrtc-msg',
                payload: {
                  type: 'join',
                  sender: user.id,
                  target: selectedStream.user_id
                }
              })
            }, 3000)
          }
        }
      })

    return () => {
      if (joinInterval) clearInterval(joinInterval)
      // Cleanup WebRTC connections
      signalingChannel.unsubscribe()
      setWebRTCStreamActive(false)
      remoteStreamRef.current = null

      // Close creator peer connections
      Object.keys(peerConnectionsRef.current).forEach(key => {
        peerConnectionsRef.current[key].close()
      })
      peerConnectionsRef.current = {}

      // Close viewer peer connection
      if (viewerPCRef.current) {
        viewerPCRef.current.close()
        viewerPCRef.current = null
      }
    }
  }, [selectedStream, user, supabase])

  // WebRTC Remote Stream Binder Hook
  useEffect(() => {
    if (webRTCStreamActive && remoteStreamRef.current && videoRef.current) {
      console.log("📺 WebRTC: Applying remote stream to video element...")
      videoRef.current.srcObject = remoteStreamRef.current
    }
  }, [webRTCStreamActive])

  // Listen to earnings statistics in real-time for the creator
  useEffect(() => {
    if (!currentActiveStream) {
      setLiveEarnings(0)
      return
    }

    const fetchInitialEarnings = async () => {
      const { data } = await supabase
        .from('live_stream_purchases')
        .select('amount')
        .eq('stream_id', currentActiveStream.id)

      if (data) {
        const total = data.reduce((acc, curr) => acc + Number(curr.amount), 0)
        setLiveEarnings(total)
      }
    }

    fetchInitialEarnings()

    const purchasesChannel = supabase
      .channel(`live_stream_purchases:${currentActiveStream.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_stream_purchases',
        filter: `stream_id=eq.${currentActiveStream.id}`
      }, (payload) => {
        setLiveEarnings(prev => prev + Number(payload.new.amount))

        toast({
          title: "Novo Ingresso Adquirido! 💸",
          description: `Um subscritor pagou para entrar na tua live!`,
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(purchasesChannel)
    }
  }, [currentActiveStream])

  // Purchase access to paid stream
  const handleBuyStreamAccess = async () => {
    if (!selectedStream) return

    setPurchasingStream(true)
    try {
      // 1. Fetch buyer profile balance
      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('balance, display_name')
        .eq('id', user.id)
        .single()

      const currentBalance = Number(buyerProfile?.balance || 0)
      const buyerName = buyerProfile?.display_name || user.email?.split('@')[0] || 'Alguém'

      if (currentBalance < selectedStream.price) {
        toast({
          title: "Saldo Insuficiente",
          description: "Precisas de carregar a tua carteira para aceder a esta stream.",
          action: (
            <ToastAction altText="Carregar" onClick={() => router.push('/dashboard?mode=wallet&view=deposit')}>
              Carregar
            </ToastAction>
          )
        })
        return
      }

      // 2. Insert purchase record
      await supabase.from('live_stream_purchases').insert({
        stream_id: selectedStream.id,
        user_id: user.id,
        amount: selectedStream.price
      })

      // 3. Record transaction for Buyer (deducts via Postgres trigger)
      await supabase.from('transactions').insert({
        user_id: user.id,
        amount: selectedStream.price,
        type: 'purchase',
        description: `Ingresso de Stream ao Vivo: ${selectedStream.title}`,
        status: 'completed'
      })

      // Fetch transaction fee from settings dynamically
      const { data: feeSetting } = await supabase.from('system_settings').select('*').eq('key', 'transaction_fee_percent').single()
      const feePercent = feeSetting ? Number(feeSetting.value) : 10
      const feeAmount = (selectedStream.price * feePercent) / 100
      const creatorEarnings = selectedStream.price - feeAmount

      // 4. Record transaction for Creator (earnings)
      await supabase.from('transactions').insert({
        user_id: selectedStream.user_id,
        amount: creatorEarnings,
        type: 'earnings',
        description: `${buyerName} comprou ingresso para a tua Stream: ${selectedStream.title} (Taxa de ${feePercent}% deduzida)`,
        status: 'completed'
      })

      // 5. Update UI & Balance
      setPurchasedStreamIds(prev => [...prev, selectedStream.id])
      setHasAccessToStream(true)
      window.dispatchEvent(new CustomEvent('balanceUpdated'))
      fetchStreamComments(selectedStream.id)

      toast({
        title: "Ingresso Adquirido!",
        description: "Entraste com sucesso na transmissão!",
      })
    } catch (err: any) {
      toast({
        title: "Erro na Compra",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setPurchasingStream(false)
    }
  }

  // Post comment to live stream chat
  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCommentText.trim() || !selectedStream) return

    const text = newCommentText
    setNewCommentText('')

    try {
      await supabase.from('live_stream_comments').insert({
        stream_id: selectedStream.id,
        user_id: user.id,
        content: text
      })
    } catch (err) {
      console.error(err)
    }
  }

  // Check subscription to creator on stream select
  useEffect(() => {
    if (!selectedStream || !user) return

    const checkSubscription = async () => {
      // Fast check if subscription exists or random mock for VIP demo experience
      setIsSubscribedToCreator(Math.random() > 0.5)
    }

    checkSubscription()
  }, [selectedStream, user])

  const handleSubscribeToCreator = () => {
    setIsSubscribedToCreator(prev => !prev)
    toast({
      title: !isSubscribedToCreator ? "Subscrito com sucesso! 🎉" : "Subscrição cancelada",
      description: !isSubscribedToCreator
        ? `Agora tens acesso a todas as publicações exclusivas deste criador!`
        : `Cancelaste a subscrição de publicações exclusivas.`,
    })
  }

  const handleSendTip = async () => {
    if (!selectedStream || !tipAmount || Number(tipAmount) <= 0) return

    setSendingTip(true)
    const amountNum = Number(tipAmount)

    try {
      // 1. Fetch current user balance
      const { data: myProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('balance, display_name')
        .eq('id', user.id)
        .single()

      if (profileErr) throw profileErr

      const currentBalance = Number(myProfile?.balance || 0)
      if (currentBalance < amountNum) {
        toast({
          title: "Saldo Insuficiente",
          description: `Tens AOA ${currentBalance.toLocaleString()} na carteira. Recarrega o teu saldo para enviar esta gorjeta!`,
          variant: "destructive"
        })
        setShowTipModal(false)
        setTipAmount('')
        return
      }

      // Fetch transaction fee from settings dynamically
      const { data: feeSetting } = await supabase.from('system_settings').select('*').eq('key', 'transaction_fee_percent').single()
      const feePercent = feeSetting ? Number(feeSetting.value) : 10
      const feeAmount = (amountNum * feePercent) / 100
      const creatorEarnings = amountNum - feeAmount

      // 3. Insert transaction log for buyer (triggers automatic profiles balance deduction)
      await supabase.from('transactions').insert({
        user_id: user.id,
        amount: amountNum,
        type: 'purchase',
        status: 'completed',
        description: `Gorjeta enviada à live de ${selectedStream.profiles?.display_name}`
      })

      // 4. Insert transaction log for creator (triggers automatic profiles balance credit)
      await supabase.from('transactions').insert({
        user_id: selectedStream.user_id,
        amount: creatorEarnings,
        type: 'earnings',
        status: 'completed',
        description: `Gorjeta recebida na live de ${myProfile.display_name} (Taxa de ${feePercent}% deduzida)`
      })

      // 5. Insert purchase record in live_stream_purchases
      await supabase.from('live_stream_purchases').insert({
        stream_id: selectedStream.id,
        user_id: user.id,
        amount: creatorEarnings
      })

      // 8. Inject custom super-chat comment
      await supabase.from('live_stream_comments').insert({
        stream_id: selectedStream.id,
        user_id: user.id,
        content: `🎉 Gorjeta de AOA ${amountNum.toLocaleString()} enviada com sucesso! Obrigado pelo carinho! 💖✨`
      })

      // Update wallet UI
      window.dispatchEvent(new CustomEvent('balanceUpdated'))

      toast({
        title: "Gorjeta Enviada! 💸🎁",
        description: `Enviaste AOA ${amountNum.toLocaleString()} com sucesso!`,
      })

      setShowTipModal(false)
      setTipAmount('')
    } catch (err: any) {
      console.error(err)
      toast({
        title: "Erro ao enviar gorjeta",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setSendingTip(false)
    }
  }

  // Start live stream as creator
  const handleStartStream = async () => {

    if (!streamTitle.trim()) {
      toast({
        title: "Título Necessário",
        description: "Define um título sedutor para a tua transmissão!",
        variant: "destructive"
      })
      return
    }

    setStartingStream(true)
    try {
      // 1. Insert live stream to DB
      const priceVal = isStreamFree ? 0 : Number(streamPrice)
      const { data: newStream, error } = await supabase
        .from('live_streams')
        .insert({
          user_id: user.id,
          title: streamTitle,
          price: priceVal,
          is_free: isStreamFree,
          is_active: true,
          viewer_count: 0
        })
        .select()
        .single()

      if (error) throw error

      const completeStream = {
        ...newStream,
        profiles: {
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          is_verified: true
        }
      }

      setCurrentActiveStream(completeStream)
      setSelectedStream(completeStream)
      setHasAccessToStream(true)
      setChatComments([])

      toast({
        title: "Transmissão Iniciada!",
        description: "Estás em direto! O teu público já te pode assistir.",
      })
    } catch (err: any) {
      toast({
        title: "Erro ao iniciar live",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setStartingStream(false)
    }
  }

  // Stop current stream as creator
  const handleStopStream = async () => {
    const streamToStop = currentActiveStream || selectedStream
    if (!streamToStop) {
      toast({
        title: "Nenhuma live ativa",
        description: "Não foi possível detetar a transmissão ativa.",
        variant: "destructive"
      })
      return
    }

    try {
      // 1. Update stream table in Supabase
      const { error } = await supabase
        .from('live_streams')
        .update({ is_active: false, viewer_count: 0 })
        .eq('id', streamToStop.id)

      if (error) throw error

      // 2. Stop camera tracks
      if (streamTrackRef.current) {
        streamTrackRef.current.getTracks().forEach(track => track.stop())
        streamTrackRef.current = null
      }

      setCurrentActiveStream(null)
      setSelectedStream(null)
      setHasAccessToStream(false)
      setStreamTitle('')

      toast({
        title: "Transmissão Encerrada",
        description: "A tua transmissão foi concluída com sucesso.",
      })
      loadActiveStreams()
    } catch (err: any) {
      console.error(err)
      toast({
        title: "Erro ao encerrar live",
        description: err.message,
        variant: "destructive"
      })
    }
  }

  // Stop watching/return to hub
  const handleLeaveStream = async () => {
    if (selectedStream) {
      try {
        const { data: currentStream } = await supabase
          .from('live_streams')
          .select('viewer_count')
          .eq('id', selectedStream.id)
          .single()

        const newCount = Math.max(0, (currentStream?.viewer_count || 0) - 1)

        await supabase
          .from('live_streams')
          .update({ viewer_count: newCount })
          .eq('id', selectedStream.id)
      } catch (err) {
        console.error('Error decrementing viewer count:', err)
      }
    }

    setSelectedStream(null)
    setHasAccessToStream(false)
    setRealViewerCount(0)
    setChatComments([])
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} />
        <div className="flex items-center justify-center pt-32">
          <Loader2 className="animate-spin text-accent" size={32} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f3f2ef] pb-12">
      <Header user={user} />

      <div className="max-w-[1128px] mx-auto flex justify-center gap-6 pt-6 px-4">
        {/* Left Sidebar */}
        <div className="hidden lg:block w-[225px] flex-shrink-0">
          <Sidebar />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 max-w-[800px] w-full">

          {/* Active Stream Viewer Screen */}
          {selectedStream ? (
            <div className="bg-white rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col md:flex-row h-[calc(100vh-140px)] md:h-[600px] mb-6 animate-in fade-in duration-300">

              {/* Stream Video Player block */}
              <div className="flex-1 bg-black relative flex items-center justify-center h-2/3 md:h-full group">

                {/* Active webcam for Streamer */}
                {selectedStream.user_id === user.id ? (
                  <div className="w-full h-full relative">
                    <ZegoStream
                      roomID={selectedStream.id}
                      userID={user.id}
                      userName={profile?.display_name || user.email?.split('@')[0] || 'Criador'}
                      isHost={true}
                      onLeave={handleStopStream}
                    />

                    {/* Bottom active control panel overlay for Creator */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 z-30 flex flex-col md:flex-row md:items-center md:justify-between gap-4 pointer-events-none">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-accent uppercase tracking-widest flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-accent rounded-full animate-ping" />
                          Painel de Transmissão Ativa
                        </span>
                        <h4 className="text-white font-extrabold text-sm mt-0.5">{selectedStream.title}</h4>
                      </div>

                      <button
                        onClick={handleStopStream}
                        className="bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold px-6 py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all uppercase tracking-wider pointer-events-auto"
                      >
                        Encerrar Stream
                      </button>
                    </div>
                  </div>
                ) : (
                  // Viewer is watching - check if they paid
                  hasAccessToStream ? (
                    <div className="w-full h-full relative">
                      <ZegoStream
                        roomID={selectedStream.id}
                        userID={user.id}
                        userName={profile?.display_name || user.email?.split('@')[0] || 'Espectador'}
                        isHost={false}
                        onLeave={handleLeaveStream}
                      />

                      {/* Interactive Creator & Tips bar overlay at the bottom for viewers */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-4 z-30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 backdrop-blur-[2px]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full border border-white/20 bg-muted overflow-hidden flex-shrink-0">
                            {selectedStream.profiles?.avatar_url ? (
                              <img src={selectedStream.profiles.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-accent text-white font-extrabold text-sm flex items-center justify-center">
                                {selectedStream.profiles?.display_name?.charAt(0) || 'C'}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col text-left">
                            <h4 className="text-white font-black text-xs sm:text-sm tracking-tight flex items-center gap-1.5">
                              {selectedStream.profiles?.display_name}
                              <span className="bg-accent text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">VIP</span>
                            </h4>
                            <span className="text-[10px] text-gray-400">Criador Exclusivo</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => setShowCreatorProfileModal(true)}
                            className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold px-3 py-2 rounded-xl backdrop-blur-md transition-all active:scale-95 border border-white/10"
                          >
                            Ver Perfil
                          </button>

                          <button
                            onClick={handleSubscribeToCreator}
                            className="bg-accent hover:bg-accent/90 text-white text-[10px] font-black px-3 py-2 rounded-xl transition-all active:scale-95 flex items-center gap-1"
                          >
                            {isSubscribedToCreator ? 'Subscrito' : 'Subscrever'}
                          </button>

                          <button
                            onClick={() => setShowTipModal(true)}
                            className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white text-[10px] font-black px-3.5 py-2 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-1 animate-pulse"
                          >
                            <DollarSign size={12} className="fill-white text-white" />
                            Enviar Gorjeta
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Luxury simulated premium visual overlay when locked
                    <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-950/80 via-black/90 to-red-950/80 z-10" />

                      {/* Simulated live visual overlay or pulse */}
                      <div className="absolute w-72 h-72 rounded-full bg-accent/20 blur-3xl animate-pulse" />

                      <div className="z-20 text-center px-6 flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-accent/10 border-2 border-accent flex items-center justify-center mb-4 animate-bounce">
                          <Tv size={36} className="text-accent" />
                        </div>
                        <h4 className="text-xl font-black text-white mb-2 tracking-tight">Transmissão em Direto de</h4>
                        <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-accent to-pink-500 mb-6 uppercase tracking-wider">
                          {selectedStream.profiles?.display_name}
                        </h3>
                        <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
                          Conexão encriptada e segura estabelecida via WebSockets. Disfruta de acesso total em tempo real!
                        </p>
                      </div>
                    </div>
                  )
                )}

                {/* Overlays */}
                <div className="absolute top-4 left-4 z-30 flex items-center gap-2 flex-wrap max-w-[90%]">
                  <span className="bg-red-600 text-white font-black text-[10px] tracking-wider uppercase px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg animate-pulse">
                    <span className="w-1.5 h-1.5 bg-white rounded-full" />
                    DIRETO
                  </span>
                  <span className="bg-black/60 backdrop-blur-md text-white font-bold text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
                    <Users size={12} />
                    {realViewerCount} assistindo
                  </span>

                  {/* Gold statistics badge for the Creator/Streamer */}
                  {selectedStream.user_id === user.id && (
                    <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-black text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg animate-in zoom-in duration-300">
                      <DollarSign size={12} className="text-white fill-white" />
                      Ganhos: AOA {liveEarnings.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Return button */}
                <button
                  onClick={selectedStream.user_id === user.id ? handleStopStream : handleLeaveStream}
                  className="absolute top-4 right-4 z-30 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-md shadow-lg transition-all"
                  title={selectedStream.user_id === user.id ? "Terminar Live" : "Sair"}
                >
                  <ArrowLeft size={18} />
                </button>

                {/* Access / Paywall Block for viewers */}
                {!hasAccessToStream && !checkingAccess && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-40 p-6 animate-in fade-in duration-300">
                    <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mb-4 shadow-xl shadow-accent/40 animate-bounce">
                      <Lock size={28} className="text-white" />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter text-center">Acesso Reservado</h3>
                    <p className="text-sm text-gray-300 mb-6 text-center max-w-xs leading-relaxed">
                      Esta transmissão é privada e exclusiva. Adquire o bilhete para entrares na live do criador.
                    </p>
                    <div className="bg-white/10 border border-white/20 p-4 rounded-2xl w-full max-w-xs flex flex-col items-center shadow-2xl">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Preço de Acesso</span>
                      <span className="text-3xl font-black text-accent tracking-tighter mb-4">AOA {selectedStream.price?.toLocaleString()}</span>

                      <button
                        onClick={handleBuyStreamAccess}
                        disabled={purchasingStream}
                        className="w-full bg-accent hover:bg-accent/90 text-white py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                      >
                        {purchasingStream ? <Loader2 size={18} className="animate-spin" /> : <Unlock size={18} />}
                        Pagar Ingresso
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Column */}
              <div className="w-full md:w-[280px] bg-white border-t md:border-t-0 md:border-l border-border flex flex-col h-1/3 md:h-full z-20">
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between bg-gray-50/50">
                  <div className="flex flex-col">
                    <span className="font-extrabold text-sm tracking-tight text-gray-900 truncate max-w-[180px]">{selectedStream.title}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Chat em Tempo Real</span>
                  </div>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                </div>

                {/* Messages container */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/20">
                  {chatComments.map((comment) => (
                    <div key={comment.id} className="flex gap-2.5 items-start">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0 border border-gray-100">
                        {comment.profiles?.avatar_url ? (
                          <img src={comment.profiles.avatar_url} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-accent text-white text-xs font-bold uppercase">
                            {comment.profiles?.display_name?.charAt(0) || 'U'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="bg-white p-2.5 rounded-2xl border border-gray-100 shadow-sm">
                          <span className="font-bold text-xs text-gray-900 block mb-0.5">{comment.profiles?.display_name}</span>
                          <p className="text-xs text-gray-700 leading-relaxed break-words">{comment.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {chatComments.length === 0 && (
                    <div className="text-center py-12 text-gray-400 flex flex-col items-center justify-center">
                      <MessageSquare size={20} className="mb-2 text-gray-300" />
                      <p className="text-[11px]">Chat seguro e encriptado. Envia a tua mensagem!</p>
                    </div>
                  )}
                </div>

                {/* Input form */}
                {hasAccessToStream ? (
                  <form onSubmit={handleSendComment} className="p-3 border-t border-border bg-white flex gap-2">
                    <input
                      type="text"
                      placeholder="Comentar na Live..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      className="flex-1 bg-gray-50 border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-accent transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!newCommentText.trim()}
                      className="bg-accent hover:bg-accent/90 disabled:opacity-50 text-white p-2 rounded-xl flex items-center justify-center transition-all flex-shrink-0"
                    >
                      <Send size={14} />
                    </button>
                  </form>
                ) : (
                  <div className="p-3 border-t border-border bg-gray-50 text-center">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Adquire o bilhete para poderes comentar!</p>
                  </div>
                )}
              </div>
            </div>
          ) : (

            // Stream Hub
            <div className="space-y-6">

              {/* Creator Live Setup Card */}
              {profile ? (
                <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                      <Radio size={22} className="animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-gray-900 uppercase tracking-tighter flex items-center gap-1.5">
                        Central de Transmissão Live
                        <CheckCircle size={16} className="text-blue-500 fill-blue-500" />
                      </h3>
                      <p className="text-xs text-muted-foreground">Transmite ao vivo para os teus fãs e monetiza o teu talento em tempo real!</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Título da Transmissão</label>
                      <input
                        type="text"
                        placeholder="Ex: Conversa Privada e Direta... 🔥"
                        value={streamTitle}
                        onChange={(e) => setStreamTitle(e.target.value)}
                        className="w-full bg-gray-50 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-accent transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Tipo de Acesso</label>
                      <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1.5 rounded-xl border border-border">
                        <button
                          onClick={() => setIsStreamFree(true)}
                          className={`py-2 rounded-lg font-bold text-xs transition-all ${isStreamFree ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                          Grátis
                        </button>
                        <button
                          onClick={() => setIsStreamFree(false)}
                          className={`py-2 rounded-lg font-bold text-xs transition-all ${!isStreamFree ? 'bg-white text-accent shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                          Pago (AOA)
                        </button>
                      </div>
                    </div>
                  </div>

                  {!isStreamFree && (
                    <div className="mb-6 max-w-xs animate-in slide-in-from-top duration-300">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Preço do Ingresso (AOA)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-extrabold text-sm">AOA</span>
                        <input
                          type="number"
                          placeholder="2000"
                          value={streamPrice}
                          onChange={(e) => setStreamPrice(e.target.value)}
                          className="w-full bg-gray-50 border border-border rounded-xl pl-14 pr-4 py-3 text-sm outline-none focus:border-accent transition-colors font-extrabold"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleStartStream}
                    disabled={startingStream}
                    className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-accent/10 transition-all disabled:opacity-50"
                  >
                    {startingStream ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                    Iniciar Transmissão ao Vivo
                  </button>
                </div>
              ) : (

                // VIP requirement banner
                <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white rounded-3xl overflow-hidden p-8 border border-white/10 relative shadow-2xl">
                  <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-accent/20 blur-3xl" />
                  <div className="max-w-md relative z-10">
                    <span className="bg-accent/10 border border-accent/20 text-accent font-black text-[9px] tracking-wider uppercase px-2.5 py-1 rounded-full inline-block mb-4">
                      MONETIZA O TEU CONTEÚDO
                    </span>
                    <h2 className="text-2xl font-black mb-2 uppercase tracking-tighter">Queres Transmitir ao Vivo? 🎥</h2>
                    <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                      Lança a tua stream privada, interage no chat em tempo real e define ingressos pagos para os teus subscritores.
                      Para iniciar lives, necessitas de ser um **Criador Verificado (Selo VIP)**.
                    </p>
                    <button
                      onClick={() => router.push('/dashboard/profile')}
                      className="bg-accent hover:bg-accent/90 text-white font-bold px-6 py-3.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg"
                    >
                      <Sparkles size={14} /> Obter Selo VIP Verificado
                    </button>
                  </div>
                </div>
              )}

              {/* Active streams grid */}
              <div className="bg-white rounded-3xl border border-border shadow-sm p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Tv size={20} className="text-gray-900" />
                  <h3 className="font-extrabold text-lg text-gray-900 tracking-tight">Transmissões Ativas em Direto</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeStreams.map((stream) => (
                    <div
                      key={stream.id}
                      onClick={() => handleSelectStream(stream)}
                      className="group cursor-pointer bg-gray-50/50 hover:bg-white border border-gray-100 hover:border-accent/30 rounded-2xl p-4 transition-all duration-300 hover:shadow-lg relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-muted border border-gray-100 flex-shrink-0">
                            {stream.profiles?.avatar_url && <img src={stream.profiles.avatar_url} className="w-full h-full object-cover" />}
                          </div>
                          <div>
                            <span className="font-extrabold text-sm text-gray-900 hover:text-accent transition-colors flex items-center gap-0.5">
                              {stream.profiles?.display_name}
                              {stream.profiles?.is_verified && <CheckCircle size={14} className="text-blue-500 fill-blue-500" />}
                            </span>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Criadora</span>
                          </div>
                        </div>

                        {stream.is_free ? (
                          <span className="bg-green-50 text-green-600 border border-green-100 font-extrabold text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Unlock size={10} />
                            Grátis
                          </span>
                        ) : (
                          <span className="bg-accent/5 text-accent border border-accent/10 font-extrabold text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Lock size={10} />
                            AOA {stream.price?.toLocaleString()}
                          </span>
                        )}
                      </div>

                      <h4 className="font-black text-[15px] leading-snug text-gray-900 mb-1 line-clamp-1 group-hover:text-accent transition-colors">
                        {stream.title}
                      </h4>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100/50">
                        <span className="bg-red-50 text-red-600 font-black text-[8px] tracking-wider uppercase px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
                          <span className="w-1 h-1 bg-red-600 rounded-full" />
                          DIRETO
                        </span>

                        <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                          <Users size={12} />
                          Aceder à Stream
                        </span>
                      </div>
                    </div>
                  ))}

                  {activeStreams.length === 0 && (
                    <div className="col-span-1 md:col-span-2 text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/30 flex flex-col items-center justify-center p-6">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
                        <Radio size={24} />
                      </div>
                      <h4 className="font-bold text-sm text-gray-700 mb-1">Sem lives ativas de momento</h4>
                      <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
                        Nenhum criador verificado está a transmitir agora. Fica atento para não perderes a próxima sessão privada!
                      </p>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

        </div>
      </div>

      {/* Gorjeta (Tip) Modal */}
      {showTipModal && selectedStream && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white border border-border w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in scale-in duration-300">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-gradient-to-tr from-amber-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/20 animate-bounce">
                <DollarSign size={28} className="text-white fill-white" />
              </div>
              <h3 className="text-lg font-black text-foreground">Enviar Gorjeta</h3>
              <p className="text-xs text-muted-foreground mt-1">Apoia a live de <span className="font-bold text-accent">{selectedStream.profiles?.display_name}</span> com uma gorjeta exclusiva.</p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Valor da Gorjeta (AOA)</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="Ex: 5000"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    className="w-full bg-gray-50 border border-border rounded-xl px-3 py-3 text-sm font-bold text-foreground outline-none focus:border-accent transition-colors pl-12"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground">AOA</span>
                </div>
              </div>

              {/* Fast selector buttons */}
              <div className="flex gap-2">
                {[1000, 2000, 5000, 10000].map(val => (
                  <button
                    key={val}
                    onClick={() => setTipAmount(val.toString())}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-foreground font-extrabold text-[10px] py-2 rounded-lg transition-all active:scale-95"
                  >
                    +{val.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTipModal(false)
                  setTipAmount('')
                }}
                disabled={sendingTip}
                className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-foreground text-xs font-bold py-3 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendTip}
                disabled={sendingTip || !tipAmount || Number(tipAmount) <= 0}
                className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 disabled:opacity-50 text-white text-xs font-black py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                {sendingTip ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <>
                    <DollarSign size={14} className="fill-white" />
                    Enviar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Creator Profile Modal */}
      {showCreatorProfileModal && selectedStream && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white border border-border w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in scale-in duration-300 relative overflow-hidden">
            {/* Background luxury gradient blur */}
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-accent/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-2xl" />

            <div className="relative z-10 text-center mb-6">
              {/* Large Avatar */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-accent to-pink-500 p-[3px] mx-auto mb-4 shadow-xl shadow-accent/20">
                <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-muted flex items-center justify-center">
                  {selectedStream.profiles?.avatar_url ? (
                    <img src={selectedStream.profiles.avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-extrabold text-2xl">
                      {selectedStream.profiles?.display_name?.charAt(0) || 'C'}
                    </span>
                  )}
                </div>
              </div>

              {/* Creator details */}
              <h3 className="text-xl font-black text-foreground flex items-center justify-center gap-1.5 leading-tight">
                {selectedStream.profiles?.display_name}
                <span className="bg-accent text-white text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">VIP</span>
              </h3>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-1">Criadora Oficial Verificada</p>

              <p className="text-xs text-gray-500 mt-4 px-2 leading-relaxed italic">
                "Olá! Bem-vindo/a ao meu perfil exclusivo. Subscreve para acederes a fotos, vídeos e transmissões privadas premium criadas com muito carinho para ti."
              </p>
            </div>

            {/* Statistics grid */}
            <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-2xl p-3 border border-border/50 mb-6">
              <div className="text-center">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Streams</span>
                <span className="text-sm font-black text-foreground">18</span>
              </div>
              <div className="text-center border-x border-border/60">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Fãs VIP</span>
                <span className="text-sm font-black text-foreground">12.4K</span>
              </div>
              <div className="text-center">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Status</span>
                <span className="text-[10px] font-black text-green-600 flex items-center justify-center gap-1 mt-0.5 animate-pulse">
                  <span className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                  DIRETO
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSubscribeToCreator}
                className="w-full bg-accent hover:bg-accent/90 text-white text-xs font-black py-3 rounded-xl transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5"
              >
                {isSubscribedToCreator ? 'Subscrito à Criadora' : 'Subscrever Canal VIP'}
              </button>

              <button
                onClick={() => setShowCreatorProfileModal(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-foreground text-xs font-bold py-3 rounded-xl transition-all active:scale-95"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
