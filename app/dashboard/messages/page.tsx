'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams, useRouter } from 'next/navigation'
import Header from '@/components/dashboard/header'
import Sidebar from '@/components/dashboard/sidebar'
import { Send, Search, Users, Loader2, ArrowLeft, Check, CheckCheck } from 'lucide-react'

function MessagesContent() {
  const [contacts, setContacts] = useState<any[]>([])
  const [selectedContact, setSelectedContact] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userBalance, setUserBalance] = useState<number>(0);
  const [freeMessagesSent, setFreeMessagesSent] = useState<number>(0)
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({})
  const searchParams = useSearchParams()
  const router = useRouter()
  const targetUserId = searchParams.get('user')
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadData() {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        router.push('/')
        return
      }
      setUser(currentUser)

      // Fetch user balance
      const { data: profile } = await supabase.from('profiles').select('balance, free_messages_sent').eq('id', currentUser.id).single()
      if (profile) {
        setUserBalance(profile.balance || 0);
        setFreeMessagesSent(profile.free_messages_sent || 0);
      }

      // Fetch contacts (people you follow or who follow you)
      // For simplicity, let's fetch everyone you've exchanged messages with or follow
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('following_id, profiles!subscriptions_following_id_fkey(id, display_name, avatar_url)')
        .eq('follower_id', currentUser.id)
      
      const subbedContacts = subs?.map((s: any) => Array.isArray(s.profiles) ? s.profiles[0] : s.profiles).filter(Boolean) || []
      setContacts(subbedContacts)

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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    // Block sending if no balance and free message limit reached
    if (userBalance <= 0 && freeMessagesSent >= 5) {
      toast({
        title: "Limite de mensagens grátis atingido",
        description: "Carrega a tua carteira para enviar mais mensagens.",
        variant: "destructive"
      })
      return
    }
    if (!newMessage.trim() || !selectedContact || !user) return

    const messageObj = {
      sender_id: user.id,
      receiver_id: selectedContact.id,
      content: newMessage.trim(),
    }

    // Optimistic update
    setMessages([...messages, { ...messageObj, created_at: new Date().toISOString(), id: 'temp' }])
    setNewMessage('')

    const { error } = await supabase.from('messages').insert(messageObj)
    if (error) {
      alert('Erro ao enviar mensagem')
      fetchMessages() // Rollback
    } else {
      // If user has no balance, increment free message count
      if (userBalance <= 0) {
        const { error: updError } = await supabase.from('profiles').update({ free_messages_sent: freeMessagesSent + 1 }).eq('id', user.id)
        if (!updError) {
          setFreeMessagesSent(prev => prev + 1)
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <Header user={user} />
      
      <div className="max-w-[1200px] mx-auto flex h-[calc(100vh-64px)] p-4 gap-4">
        {/* Desktop Sidebar Wrapper */}
        <div className="hidden lg:block w-[225px] flex-shrink-0">
          <Sidebar />
        </div>

        {/* Contacts Sidebar */}
        <div className={`w-full md:w-[360px] bg-white rounded-2xl shadow-sm border border-border flex flex-col overflow-hidden ${selectedContact ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-border bg-white sticky top-0 z-10">
            <h2 className="text-xl font-bold mb-4">Mensagens</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Pesquisar conversas" 
                className="w-full bg-gray-100 border-none rounded-full py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-accent/20"
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
                  className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 ${selectedContact?.id === contact.id ? 'bg-accent/5 border-l-4 border-l-accent' : ''}`}
                >
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden shadow-sm">
                    {contact.avatar_url ? <img src={contact.avatar_url} className="w-full h-full object-cover" /> : contact.display_name?.charAt(0)}
                  </div>
                  <div className="text-left overflow-hidden flex-1">
                    <p className="font-bold text-gray-900 truncate">{contact.display_name}</p>
                    <p className="text-xs text-gray-500 truncate">Clique para iniciar conversa</p>
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
        <div className={`flex-1 bg-white rounded-2xl shadow-sm border border-border flex flex-col overflow-hidden relative ${!selectedContact ? 'hidden md:flex' : 'flex'}`}>
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedContact(null)} className="md:hidden p-2 -ml-2 text-gray-500 hover:text-accent"><ArrowLeft size={20} /></button>
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-bold overflow-hidden shadow-sm">
                    {selectedContact.avatar_url ? <img src={selectedContact.avatar_url} className="w-full h-full object-cover" /> : selectedContact.display_name?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{selectedContact.display_name}</p>
                    <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Online agora</p>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#f0f2f5]/50">
                {messages.map((msg, idx) => {
                  const isMine = msg.sender_id === user.id
                  return (
                    <div key={idx} className={`flex ${isMine ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                      <div className={`max-w-[70%] p-3 rounded-2xl text-sm shadow-sm ${
                        isMine 
                          ? 'bg-accent text-white rounded-tr-none' 
                          : 'bg-white text-gray-900 rounded-tl-none border border-gray-100'
                      }`}>
                        <p className="leading-relaxed">{msg.content}</p>
                        <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
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
              <div className="p-4 bg-white border-t border-border">
                {userBalance <= 0 ? (
                  freeMessagesSent < 5 ? (
                    <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl text-center text-sm font-medium border border-yellow-200 shadow-sm animate-in fade-in zoom-in duration-300">
                      Tens {5 - freeMessagesSent} mensagens gratuitas restantes. <a href="/dashboard?mode=wallet&view=deposit" className="underline font-bold hover:text-yellow-900">Carrega a tua carteira</a> para desbloquear mensagens ilimitadas.
                    </div>
                  ) : (
                    <div className="p-4 bg-red-50 text-red-600 rounded-xl text-center text-sm font-medium border border-red-100 shadow-sm animate-in fade-in zoom-in duration-300">
                      O teu saldo é insuficiente e já usaste as 5 mensagens gratuitas. Por favor, <a href="/dashboard?mode=wallet&view=deposit" className="underline font-bold hover:text-red-700">carrega a tua carteira</a> para continuar a conversar.
                    </div>
                  )
                ) : (
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Escreve uma mensagem..." 
                      className="flex-1 bg-gray-100 border-none rounded-full py-3 px-6 text-sm outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                    />
                    <button 
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="w-12 h-12 bg-accent text-white rounded-full flex items-center justify-center hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 disabled:opacity-50 disabled:shadow-none"
                    >
                      <Send size={20} className="ml-1" />
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-[#f8f9fa]">
              <div className="w-24 h-24 bg-accent/5 rounded-full flex items-center justify-center mb-6">
                <Send size={40} className="text-accent opacity-20 rotate-12" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">As tuas mensagens</h3>
              <p className="text-gray-500 max-w-xs">Seleciona uma conversa ou subscreve a um criador para iniciares um chat privado.</p>
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
