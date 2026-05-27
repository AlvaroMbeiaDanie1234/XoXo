'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import Header from '@/components/dashboard/header'
import Sidebar from '@/components/dashboard/sidebar'
import { Send, Search, Users, Loader2, ArrowLeft, Check, CheckCheck, Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react'
import { useOnlinePresence } from '@/hooks/use-online-presence'

function MessagesContent() {
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const { isOnline } = useOnlinePresence(user?.id ?? null)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    async function loadData() {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        router.push('/')
        return
      }
      setUser(currentUser)

      // Fetch user balance
      const { data: profile } = await supabase.from('profiles').select('balance').eq('id', currentUser.id).single()
      if (profile) {
        const val = Number(profile.balance);
        setUserBalance(isNaN(val) ? 0 : val);
      }

      const tierRes = await fetch('/api/free-tier/status')
      if (tierRes.ok) {
        const tier = await tierRes.json()
        setFreeTierStatus(tier)
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

      setContacts(allContacts)

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
          setMessages(prev => [...prev, payload.new])
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

    const contentToSend = newMessage.trim()
    const messageObj = {
      sender_id: user.id,
      receiver_id: selectedContact.id,
      content: contentToSend || (fileName ? `[Ficheiro: ${fileName}]` : ''),
      file_url: fileUrl,
      file_name: fileName,
      file_type: fileType,
    }

    setMessages([...messages, { ...messageObj, created_at: new Date().toISOString(), id: 'temp' }])
    setNewMessage('')

    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiver_id: selectedContact.id,
        content: contentToSend || (fileName ? `[Ficheiro: ${fileName}]` : ''),
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
        setSelectedFile(null)
      }
    }
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900' : 'bg-[#f0f2f5]'}`}>
      <Header user={user} />
      
      <div className="max-w-[1200px] mx-auto flex h-[calc(100vh-64px)] p-4 gap-4">
        {/* Desktop Sidebar Wrapper */}
        <div className="hidden lg:block w-[225px] flex-shrink-0">
          <Sidebar />
        </div>

        {/* Contacts Sidebar */}
        <div className={`w-full md:w-[360px] rounded-2xl shadow-sm border border-border flex flex-col overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white'} ${selectedContact ? 'hidden md:flex' : 'flex'}`}>
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
        <div className={`flex-1 rounded-2xl shadow-sm border border-border flex flex-col overflow-hidden relative transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white'} ${!selectedContact ? 'hidden md:flex' : 'flex'}`}>
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className={`p-4 border-b border-border flex items-center justify-between backdrop-blur-md sticky top-0 z-10 transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80'}`}>
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedContact(null)} className={`md:hidden p-2 -ml-2 ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-accent'}`}><ArrowLeft size={20} /></button>
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-bold overflow-hidden shadow-sm">
                    {selectedContact.avatar_url ? <img src={selectedContact.avatar_url} className="w-full h-full object-cover" /> : selectedContact.display_name?.charAt(0)}
                  </div>
                  <div>
                    <p className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedContact.display_name}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isOnline(selectedContact.id) ? 'text-green-500' : theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`}>{isOnline(selectedContact.id) ? 'Online agora' : 'Offline'}</p>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className={`flex-1 overflow-y-auto p-6 space-y-4 transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900/50' : 'bg-[#f0f2f5]/50'}`}>
                {messages.map((msg, idx) => {
                  const isMine = msg.sender_id === user.id
                  return (
                    <div key={idx} className={`flex ${isMine ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                      <div className={`max-w-[70%] p-3 rounded-2xl text-sm shadow-sm ${
                        isMine
                          ? 'bg-accent text-white rounded-tr-none'
                          : `${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'} rounded-tl-none border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-100'}`
                      }`}>
                        {msg.file_url && (
                          <div className="mb-1">
                            {msg.file_type?.startsWith('image/') ? (
                              <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                                <img src={msg.file_url} alt={msg.file_name || 'Imagem'} className="max-w-full rounded-lg max-h-48 object-cover" />
                              </a>
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
                        {msg.content && !msg.content.startsWith('[Ficheiro:') && (
                          <p className="leading-relaxed">{msg.content}</p>
                        )}
                        <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${isMine ? 'text-white/70' : theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isMine && (msg.is_read ? <CheckCheck size={12} /> : <Check size={12} />)}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className={`p-4 border-t border-border transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
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
                      <div className={`mb-2 flex items-center gap-2 px-3 py-2 rounded-xl ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        {selectedFile.type.startsWith('image/') ? <ImageIcon size={16} className="text-accent" /> : <FileText size={16} className="text-accent" />}
                        <span className={`text-xs truncate flex-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{selectedFile.name}</span>
                        <button type="button" onClick={() => setSelectedFile(null)} className={`hover:text-red-500 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`}><X size={14} /></button>
                      </div>
                    )}
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) setSelectedFile(file)
                          e.target.value = ''
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-accent hover:bg-gray-100'}`}
                        title="Anexar ficheiro"
                      >
                        <Paperclip size={20} />
                      </button>
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Escreve uma mensagem..."
                        className={`flex-1 border-none rounded-full py-3 px-6 text-sm outline-none focus:ring-2 focus:ring-accent/20 transition-all ${theme === 'dark' ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-gray-100'}`}
                      />
                      <button 
                        type="submit"
                        disabled={(!newMessage.trim() && !selectedFile) || uploadingFile}
                        className="w-12 h-12 bg-accent text-white rounded-full flex items-center justify-center hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 disabled:opacity-50 disabled:shadow-none"
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
