'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import Header from '@/components/dashboard/header'
import Sidebar from '@/components/dashboard/sidebar'
import { Send, Search, Users, Loader2, ArrowLeft, Check, CheckCheck, Paperclip, X, FileText, Image as ImageIcon, Mic, Square, Trash2 } from 'lucide-react'
import { useOnlinePresence } from '@/hooks/use-online-presence'
import { readTimedCache, writeTimedCache } from '@/lib/client-cache'

function MessagesContent() {
  const MESSAGES_CACHE_TTL_MS = 45 * 1000
  const [contacts, setContacts] = useState<any[]>([])
  const [selectedContact, setSelectedContact] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userBalance, setUserBalance] = useState<number>(0);
  const [freeTierStatus, setFreeTierStatus] = useState<{
    hasDeposited: boolean
    messagesRemaining: number
    messagesUsed: number
    limit: number
    balance: number
    canUseBonusCredit: boolean
  } | null>(null)
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({})
  const searchParams = useSearchParams()
  const router = useRouter()
  const targetUserId = searchParams.get('user')
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const deleteMenuRef = useRef<HTMLDivElement>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [recordingAudio, setRecordingAudio] = useState(false)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null)
  const [fileInputAccept, setFileInputAccept] = useState('')
  const audioRecorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioPreviewUrlRef = useRef<string | null>(null)
  const { isOnline } = useOnlinePresence(user?.id ?? null)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (deleteMenuRef.current && !deleteMenuRef.current.contains(e.target as Node)) {
        setDeleteTargetId(null)
      }
    }
    if (deleteTargetId) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [deleteTargetId])

  useEffect(() => {
    return () => {
      audioStreamRef.current?.getTracks().forEach((track) => track.stop())
      if (audioPreviewUrlRef.current) {
        URL.revokeObjectURL(audioPreviewUrlRef.current)
      }
    }
  }, [])

  useEffect(() => {
    async function loadData() {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        router.push('/')
        return
      }
      setUser(currentUser)
      const cacheKey = `xoxo:messages:overview:${currentUser.id}`
      const cached = readTimedCache<{
        contacts: any[]
        unreadCounts: { [key: string]: number }
        userBalance: number
        freeTierStatus: any
      }>(cacheKey, MESSAGES_CACHE_TTL_MS)

      if (cached) {
        setContacts(cached.contacts || [])
        setUnreadCounts(cached.unreadCounts || {})
        setUserBalance(Number(cached.userBalance || 0))
        setFreeTierStatus(cached.freeTierStatus || null)
        setLoading(false)
      }

      // Fetch user balance
      const { data: profile } = await supabase.from('profiles').select('balance').eq('id', currentUser.id).single()
      if (profile) {
        const val = Number(profile.balance);
        setUserBalance(isNaN(val) ? 0 : val);
      }

      let tierData: any = null
      const tierRes = await fetch('/api/free-tier/status')
      if (tierRes.ok) {
        tierData = await tierRes.json()
        setFreeTierStatus(tierData)
      }

      // Fetch contacts (people you follow or who follow you)
      // For simplicity, let's fetch everyone you've exchanged messages with or follow
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('following_id, profiles!subscriptions_following_id_fkey(id, display_name, avatar_url)')
        .eq('follower_id', currentUser.id)

      const subbedContacts = subs?.map((s: any) => Array.isArray(s.profiles) ? s.profiles[0] : s.profiles).filter(Boolean) || []

      // Also fetch people who sent you messages (even if you don't follow them)
      const { data: messageSenders } = await supabase
        .from('messages')
        .select('sender_id, profiles!messages_sender_id_fkey(id, display_name, avatar_url)')
        .eq('receiver_id', currentUser.id)

      const senderContacts = messageSenders?.map((m: any) => Array.isArray(m.profiles) ? m.profiles[0] : m.profiles).filter(Boolean) || []

      // Merge both lists, removing duplicates
      const allContacts = [...subbedContacts]
      senderContacts.forEach((contact: any) => {
        if (!allContacts.find((c: any) => c.id === contact.id)) {
          allContacts.push(contact)
        }
      })

      // Fetch last message for each contact to sort by most recent
      const contactsWithLastMessage = await Promise.all(
        allContacts.map(async (contact: any) => {
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('created_at')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${contact.id}),and(sender_id.eq.${contact.id},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          return {
            ...contact,
            lastMessageAt: lastMsg?.created_at || null
          }
        })
      )

      // Sort contacts by last message date (most recent first)
      const sortedContacts = contactsWithLastMessage.sort((a: any, b: any) => {
        if (!a.lastMessageAt && !b.lastMessageAt) return 0
        if (!a.lastMessageAt) return 1
        if (!b.lastMessageAt) return -1
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      })

      setContacts(sortedContacts)

      // Fetch unread message counts from everyone
      const { data: unreadData } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('receiver_id', currentUser.id)
        .eq('is_read', false)
      
      const counts: { [key: string]: number } = {}
      unreadData?.forEach(m => {
        counts[m.sender_id] = (counts[m.sender_id] || 0) + 1
      })
      setUnreadCounts(counts)

      if (targetUserId) {
        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', targetUserId)
          .single()
        
        if (targetProfile) {
          setSelectedContact(targetProfile)
          // Add to contacts if not there
          if (!subbedContacts.find(c => c.id === targetUserId)) {
            setContacts([targetProfile, ...subbedContacts])
          }
        }
      }

      writeTimedCache(cacheKey, {
        contacts: sortedContacts,
        unreadCounts: counts,
        userBalance: Number(profile?.balance || 0),
        freeTierStatus: tierData,
      })

      setLoading(false)
    }

    loadData()
  }, [targetUserId, supabase, router])

  const markAsRead = async (contactId: string) => {
    if (!user) return
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', contactId)
      .eq('receiver_id', user.id)
      .eq('is_read', false)
    
    setUnreadCounts(prev => ({ ...prev, [contactId]: 0 }))
  }

  // Load chat messages and mark as read when selecting a contact
  useEffect(() => {
    if (selectedContact && user) {
      fetchMessages()
      markAsRead(selectedContact.id)
    }
  }, [selectedContact, user])

  // Global real-time listener for incoming messages to track unread count badge count per contact
  useEffect(() => {
    if (!user) return

    const globalChannel = supabase
      .channel('incoming_messages_global')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user.id}`
      }, (payload) => {
        const senderId = payload.new.sender_id
        
        // If we are actively chatting with this sender, append and mark as read immediately
        if (selectedContact && selectedContact.id === senderId) {
          setMessages(prev => prev.some((msg) => msg.id === payload.new.id) ? prev : [...prev, payload.new])
          markAsRead(senderId)
        } else {
          // Increment unread count for the sender
          setUnreadCounts(prev => ({
            ...prev,
            [senderId]: (prev[senderId] || 0) + 1
          }))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(globalChannel)
    }
  }, [user, selectedContact])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
    
    if (data) setMessages(data)
  }

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Tens a certeza que queres eliminar esta mensagem?')) return
    const res = await fetch('/api/messages/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    })
    if (res.ok) {
      setMessages(prev => prev.filter(msg => msg.id !== messageId))
    } else {
      const data = await res.json()
      alert(data.error || 'Erro ao eliminar mensagem')
    }
  }

  const clearSelectedFile = () => {
    setSelectedFile(null)
    setRecordingError(null)
    if (audioPreviewUrlRef.current) {
      URL.revokeObjectURL(audioPreviewUrlRef.current)
      audioPreviewUrlRef.current = null
    }
    setAudioPreviewUrl(null)
  }

  const setAttachmentFile = (file: File) => {
    clearSelectedFile()
    setSelectedFile(file)

    if (file.type.startsWith('audio/')) {
      const previewUrl = URL.createObjectURL(file)
      audioPreviewUrlRef.current = previewUrl
      setAudioPreviewUrl(previewUrl)
    }
  }

  const openFilePicker = (accept = '') => {
    setFileInputAccept(accept)
    requestAnimationFrame(() => fileInputRef.current?.click())
  }

  const getAudioExtension = (mimeType: string) => {
    if (mimeType.includes('ogg')) return 'ogg'
    if (mimeType.includes('mpeg')) return 'mp3'
    if (mimeType.includes('mp4')) return 'm4a'
    if (mimeType.includes('wav')) return 'wav'
    return 'webm'
  }

  const getAttachmentFallback = (fileName: string | null, fileType: string | null) => {
    if (fileType?.startsWith('audio/')) return '[Audio]'
    return fileName ? `[Ficheiro: ${fileName}]` : ''
  }

  const isAttachmentOnlyText = (content: string | null | undefined) => {
    return !!content && (content.startsWith('[Ficheiro:') || content.startsWith('[Audio]'))
  }

  const stopAudioTracks = () => {
    audioStreamRef.current?.getTracks().forEach((track) => track.stop())
    audioStreamRef.current = null
  }

  const startAudioRecording = async () => {
    if (recordingAudio || uploadingFile) return

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingError('O teu navegador nao suporta gravacao de audio.')
      return
    }

    try {
      clearSelectedFile()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

      audioStreamRef.current = stream
      audioChunksRef.current = []
      audioRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const recordedMimeType = recorder.mimeType || 'audio/webm'
        const blob = new Blob(audioChunksRef.current, { type: recordedMimeType })
        stopAudioTracks()
        setRecordingAudio(false)

        if (!blob.size) {
          setRecordingError('Nao foi possivel gravar audio. Tenta novamente.')
          return
        }

        const audioFile = new File(
          [blob],
          `audio-${Date.now()}.${getAudioExtension(recordedMimeType)}`,
          { type: recordedMimeType },
        )
        setAttachmentFile(audioFile)
      }

      recorder.onerror = () => {
        stopAudioTracks()
        setRecordingAudio(false)
        setRecordingError('Nao foi possivel gravar audio. Tenta novamente.')
      }

      recorder.start()
      setRecordingAudio(true)
      setRecordingError(null)
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'NotAllowedError') {
        console.error('Erro ao iniciar gravacao de audio:', error)
      }
      stopAudioTracks()
      setRecordingAudio(false)
      setRecordingError('Microfone bloqueado. Permite o acesso no navegador ou anexa um ficheiro de audio.')
    }
  }

  const stopAudioRecording = () => {
    if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
      audioRecorderRef.current.stop()
    }
  }

  const uploadFile = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop() || 'bin'
    const filePath = `messages/${user.id}/${Date.now()}.${ext}`

    try {
      const urlRes = await fetch('/api/storage/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      })
      if (!urlRes.ok) {
        console.error('Erro ao obter URL de upload:', await urlRes.text())
        return null
      }
      const { data: urlData } = await urlRes.json()

      const { error: uploadError } = await supabase.storage
        .from('media')
        .uploadToSignedUrl(filePath, urlData.token, file)
      if (uploadError) {
        console.error('Erro no upload do arquivo:', uploadError)
        return null
      }

      const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(filePath)
      return publicUrlData.publicUrl
    } catch (error) {
      console.error('Erro no upload:', error)
      return null
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!newMessage.trim() && !selectedFile) || !selectedContact || !user) return

    let fileUrl: string | null = null
    let fileName: string | null = null
    let fileType: string | null = null

    if (selectedFile) {
      setUploadingFile(true)
      fileUrl = await uploadFile(selectedFile)
      fileName = selectedFile.name
      fileType = selectedFile.type
      setUploadingFile(false)
      if (!fileUrl) {
        alert('Erro ao enviar ficheiro. Tenta novamente.')
        return
      }
    }

    const attachmentFallback = getAttachmentFallback(fileName, fileType)
    const contentToSend = newMessage.trim()
    const messageObj = {
      sender_id: user.id,
      receiver_id: selectedContact.id,
      content: contentToSend || attachmentFallback,
      file_url: fileUrl,
      file_name: fileName,
      file_type: fileType,
    }

    setMessages((prev) => [...prev, { ...messageObj, created_at: new Date().toISOString(), id: `temp-${Date.now()}` }])
    setNewMessage('')

    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiver_id: selectedContact.id,
        content: contentToSend || attachmentFallback,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      if (data.error === 'DEPOSIT_REQUIRED') {
        alert(data.message)
        router.push('/dashboard?mode=wallet&view=deposit&required=1')
      } else {
        alert(data.message || 'Erro ao enviar mensagem')
      }
      fetchMessages()
    } else {
      // Só limpa o arquivo se a mensagem foi enviada com sucesso
      if (selectedFile) {
        clearSelectedFile()
      }
    }
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900' : 'bg-[#f0f2f5]'}`}>
      <Header user={user} />
      
      <div className="mx-auto flex h-[calc(100dvh-64px)] max-w-[1200px] gap-0 p-0 md:gap-4 md:p-4">
        {/* Desktop Sidebar Wrapper */}
        <div className="hidden lg:block w-[225px] flex-shrink-0">
          <Sidebar />
        </div>

        {/* Contacts Sidebar */}
        <div className={`flex w-full flex-col overflow-hidden border-y border-border shadow-sm transition-colors duration-300 md:w-[360px] md:rounded-2xl md:border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white'} ${selectedContact ? 'hidden md:flex' : 'flex'}`}>
          <div className={`p-4 border-b border-border sticky top-0 z-10 transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : ''}`}>Mensagens</h2>
            </div>
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`} size={18} />
              <input 
                type="text" 
                placeholder="Pesquisar conversas" 
                className={`w-full border-none rounded-full py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-accent/20 transition-colors ${theme === 'dark' ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-gray-100'}`}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-accent" /></div>
            ) : contacts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Users className="mx-auto mb-2 opacity-20" size={48} />
                <p className="text-sm">Ainda não tens subscrições para conversar.</p>
              </div>
            ) : (
              contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  className={`w-full p-4 flex items-center gap-3 transition-colors border-b ${theme === 'dark' ? 'hover:bg-gray-700 border-gray-700' : 'hover:bg-gray-50 border-gray-50'} ${selectedContact?.id === contact.id ? 'bg-accent/5 border-l-4 border-l-accent' : ''}`}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden shadow-sm">
                      {contact.avatar_url ? <img src={contact.avatar_url} className="w-full h-full object-cover" /> : contact.display_name?.charAt(0)}
                    </div>
                    {isOnline(contact.id) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div className="text-left overflow-hidden flex-1">
                    <p className={`font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{contact.display_name}</p>
                    <p className={`text-xs truncate ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Clique para iniciar conversa</p>
                  </div>
                  {unreadCounts[contact.id] > 0 && (
                    <span className="bg-accent text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm animate-in zoom-in duration-300 flex-shrink-0 ml-auto">
                      {unreadCounts[contact.id]}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className={`relative flex flex-1 flex-col overflow-hidden border-y border-border shadow-sm transition-colors duration-300 md:rounded-2xl md:border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white'} ${!selectedContact ? 'hidden md:flex' : 'flex'}`}>
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className={`sticky top-0 z-10 flex items-center justify-between border-b border-border p-3 backdrop-blur-md transition-colors duration-300 sm:p-4 ${theme === 'dark' ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80'}`}>
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedContact(null)} className={`md:hidden p-2 -ml-2 ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-accent'}`}><ArrowLeft size={20} /></button>
                  <Link href={`/dashboard/creator/${selectedContact.id}`} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-bold overflow-hidden shadow-sm">
                      {selectedContact.avatar_url ? <img src={selectedContact.avatar_url} className="w-full h-full object-cover" /> : selectedContact.display_name?.charAt(0)}
                    </div>
                    <div>
                      <p className={`font-bold hover:text-accent transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedContact.display_name}</p>
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${isOnline(selectedContact.id) ? 'text-green-500' : theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`}>{isOnline(selectedContact.id) ? 'Online agora' : 'Offline'}</p>
                    </div>
                  </Link>
                </div>
              </div>

              {/* Messages Area */}
              <div className={`flex-1 space-y-4 overflow-y-auto p-3 transition-colors duration-300 sm:p-4 md:p-6 ${theme === 'dark' ? 'bg-gray-900/50' : 'bg-[#f0f2f5]/50'}`}>
                {messages.map((msg, idx) => {
                  const isMine = msg.sender_id === user.id
                  return (
                    <div key={idx} className={`flex ${isMine ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                      <div
                        onClick={isMine ? () => setDeleteTargetId(deleteTargetId === msg.id ? null : msg.id) : undefined}
                        className={`relative max-w-[84%] break-words rounded-2xl p-3 text-sm shadow-sm sm:max-w-[70%] ${
                        isMine
                          ? 'bg-accent text-white rounded-tr-none'
                          : `${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'} rounded-tl-none border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-100'}`
                      } ${isMine ? 'cursor-pointer' : ''}`}>
                        {msg.file_url && (
                          <div className="mb-1 relative z-10" onClick={(e) => e.stopPropagation()}>
                            {msg.file_type?.startsWith('audio/') ? (
                              <div className={`rounded-xl px-2 py-2 ${isMine ? 'bg-white/20' : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-100'}`}>
                                <audio controls src={msg.file_url} preload="metadata" className="h-9 w-56 max-w-full" />
                              </div>
                            ) : msg.file_type?.startsWith('image/') ? (
                              <button onClick={() => setPreviewImageUrl(msg.file_url)} className="block w-full text-left">
                                <img src={msg.file_url} alt={msg.file_name || 'Imagem'} className="max-w-full rounded-lg max-h-48 object-cover" />
                              </button>
                            ) : (
                              <a
                                href={msg.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${isMine ? 'bg-white/20 hover:bg-white/30' : theme === 'dark' ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-100 hover:bg-gray-200'}`}
                              >
                                <FileText size={16} />
                                {msg.file_name || 'Ficheiro'}
                              </a>
                            )}
                          </div>
                        )}
                        {msg.content && !isAttachmentOnlyText(msg.content) && (
                          <p className="leading-relaxed relative z-10">{msg.content}</p>
                        )}
                        <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] relative z-10 ${isMine ? 'text-white/70' : theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isMine && (msg.is_read ? <CheckCheck size={12} /> : <Check size={12} />)}
                        </div>

                        {isMine && deleteTargetId === msg.id && (
                          <div
                            ref={deleteMenuRef}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute bottom-full right-0 mb-2 z-50 min-w-[180px] rounded-xl border shadow-xl bg-white dark:bg-gray-800 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in duration-200"
                          >
                            <button
                              onClick={() => {
                                handleDeleteMessage(msg.id)
                                setDeleteTargetId(null)
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Trash2 size={16} />
                              Eliminar mensagem
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className={`border-t border-border p-2 transition-colors duration-300 sm:p-4 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
                {freeTierStatus && !freeTierStatus.hasDeposited && freeTierStatus.messagesRemaining <= 0 && !freeTierStatus.canUseBonusCredit ? (
                  <div className="p-4 bg-red-50 text-red-600 rounded-xl text-center text-sm font-medium border border-red-100 shadow-sm animate-in fade-in zoom-in duration-300">
                    Atingiste o limite de {freeTierStatus.limit} mensagens gratuitas.{' '}
                    <a href="/dashboard?mode=wallet&view=deposit&required=1" className="underline font-bold hover:text-red-700">
                      Realiza um depósito
                    </a>{' '}
                    para continuar a conversar.
                  </div>
                ) : (
                  <>
                    {freeTierStatus && !freeTierStatus.hasDeposited && freeTierStatus.messagesRemaining <= 0 && freeTierStatus.canUseBonusCredit && (
                      <div className="mb-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-[11px] text-amber-700 font-medium text-center">
                        Mensagens gratuitas esgotadas — a utilizar saldo de bónus ({freeTierStatus.balance.toLocaleString()} AOA)
                      </div>
                    )}
                    {freeTierStatus && !freeTierStatus.hasDeposited && freeTierStatus.messagesRemaining > 0 && (
                      <div className="mb-2 px-3 py-1.5 bg-gray-100 rounded-full text-[11px] text-gray-500 font-medium text-center">
                        {freeTierStatus.messagesRemaining} mensagem(ns) gratuita(s) restante(s) de {freeTierStatus.limit}
                      </div>
                    )}
                    {selectedFile && (
                      <div className={`mb-2 flex items-center gap-2 rounded-xl px-3 py-2 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        {selectedFile.type.startsWith('audio/') ? <Mic size={16} className="text-accent" /> : selectedFile.type.startsWith('image/') ? <ImageIcon size={16} className="text-accent" /> : <FileText size={16} className="text-accent" />}
                        <div className="min-w-0 flex-1">
                          <span className={`block truncate text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{selectedFile.type.startsWith('audio/') ? 'Mensagem de audio pronta' : selectedFile.name}</span>
                          {selectedFile.type.startsWith('audio/') && audioPreviewUrl && (
                            <audio controls src={audioPreviewUrl} preload="metadata" className="mt-2 h-8 w-full max-w-[260px]" />
                          )}
                        </div>
                        <button type="button" onClick={clearSelectedFile} className={`hover:text-red-500 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`}><X size={14} /></button>
                      </div>
                    )}
                    {recordingAudio && (
                      <div className="mb-2 flex items-center justify-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-red-600">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                        A gravar audio
                      </div>
                    )}
                    {recordingError && (
                      <div className="mb-2 flex flex-col items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-600 sm:flex-row sm:justify-center">
                        <span>{recordingError}</span>
                        <button
                          type="button"
                          onClick={() => openFilePicker('audio/*')}
                          className="rounded-full bg-white px-3 py-1 font-bold text-red-600 shadow-sm transition-colors hover:bg-red-100"
                        >
                          Anexar audio
                        </button>
                      </div>
                    )}
                    <form onSubmit={handleSendMessage} className="flex min-w-0 items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={fileInputAccept}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) setAttachmentFile(file)
                          e.target.value = ''
                          setFileInputAccept('')
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => openFilePicker()}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-accent hover:bg-gray-100'}`}
                        title="Anexar ficheiro"
                      >
                        <Paperclip size={20} />
                      </button>
                      <button
                        type="button"
                        onClick={recordingAudio ? stopAudioRecording : startAudioRecording}
                        disabled={uploadingFile}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                          recordingAudio
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : theme === 'dark'
                              ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
                              : 'text-gray-500 hover:bg-gray-100 hover:text-accent'
                        }`}
                        title={recordingAudio ? 'Parar gravacao' : 'Gravar audio'}
                      >
                        {recordingAudio ? <Square size={18} /> : <Mic size={20} />}
                      </button>
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Escreve uma mensagem..."
                        className={`min-w-0 flex-1 rounded-full border-none px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/20 sm:px-6 ${theme === 'dark' ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-gray-100'}`}
                      />
                      <button 
                        type="submit"
                        disabled={(!newMessage.trim() && !selectedFile) || uploadingFile || recordingAudio}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent/90 disabled:opacity-50 disabled:shadow-none sm:h-12 sm:w-12"
                      >
                        {uploadingFile ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-1" />}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className={`flex-1 flex flex-col items-center justify-center text-center p-12 transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900' : 'bg-[#f8f9fa]'}`}>
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-accent/5'}`}>
                <Send size={40} className={`text-accent opacity-20 rotate-12`} />
              </div>
              <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>As tuas mensagens</h3>
              <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Seleciona uma conversa ou subscreve a um criador para iniciares um chat privado.</p>
            </div>
          )}
        </div>
      </div>

      {/* Image Lightbox */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewImageUrl(null)}
        >
          <button
            onClick={() => setPreviewImageUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X size={24} />
          </button>
          <img
            src={previewImageUrl}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] rounded-2xl shadow-2xl animate-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center"><Loader2 className="animate-spin text-accent" /></div>}>
      <MessagesContent />
    </Suspense>
  )
}
