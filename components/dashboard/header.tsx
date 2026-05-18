'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Wallet, DollarSign, LogOut, Bell, Circle, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import DepositModal from './deposit-modal'

interface HeaderProps {
  user: any
  onMenuClick?: () => void
}

export default function Header({ user, onMenuClick }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const [balance, setBalance] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const [displayName, setDisplayName] = useState('')

  // Search states & refs
  const searchRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingSearch, setLoadingSearch] = useState(false)

  const loadBalance = async () => {
    if (!user) return
    const { data } = await supabase.from('profiles').select('balance, display_name').eq('id', user.id).single()
    if (data) {
      setBalance(data.balance || 0)
      setDisplayName(data.display_name || user.email?.split('@')[0] || 'Usuário')
    }
  }

  const loadNotifications = async () => {
    if (!user) return
    // Fetch recent earnings (sales) as notifications
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'earnings')
      .order('created_at', { ascending: false })
      .limit(5)

    if (data) {
      setNotifications(data)
      // Since we don't have an is_read field on transactions, we can just highlight them all
      // or assume the first 1-2 are new for visual flair.
      setUnreadCount(data.length > 0 ? 1 : 0) // Just to show a red dot if they have earnings
    }
  }

  useEffect(() => {
    if (user) {
      loadBalance()
      loadNotifications()
    }

    const handleBalanceUpdate = () => {
      loadBalance()
      loadNotifications()
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false)
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    window.addEventListener('balanceUpdated', handleBalanceUpdate)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      window.removeEventListener('balanceUpdated', handleBalanceUpdate)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [user, supabase])

  // Real-time Facebook-style search autocomplete logic with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setLoadingSearch(true)
    const delayDebounce = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, email, avatar_url, is_verified, bio')
          .or(`display_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
          .order('is_verified', { ascending: false })
          .limit(6)

        if (!error && data) {
          setSearchResults(data)
        }
      } catch (err) {
        console.error("Erro na pesquisa:", err)
      } finally {
        setLoadingSearch(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(delayDebounce)
  }, [searchQuery, supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const toggleNotif = () => {
    setNotifOpen(!notifOpen)
    if (!notifOpen) setUnreadCount(0)
  }

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-border shadow-sm w-full">
      <div className="max-w-[1128px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-xl font-bold text-accent">XoXo</Link>

          {/* Modern Facebook-style Autocomplete Search bar */}
          <div className="hidden sm:block relative" ref={searchRef}>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#f3f2ef] border border-border w-64 transition-all focus-within:w-80 focus-within:bg-white focus-within:border-accent/40 focus-within:shadow-md">
              <Search size={16} className="text-gray-500 flex-shrink-0" />
              <input
                type="text"
                placeholder="Pesquisar utilizadores..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                className="w-full bg-transparent text-sm outline-none placeholder-gray-500 text-gray-900"
              />
            </div>

            {/* suggestions dropdown list */}
            {showSuggestions && searchQuery.trim() !== '' && (
              <div className="absolute left-0 mt-2 w-80 bg-white/95 backdrop-blur-md rounded-2xl border border-gray-100 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-3 duration-200">
                <div className="p-3 border-b border-gray-50 bg-gray-50/40 flex justify-between items-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sugestões de Pesquisa</p>
                  {loadingSearch && (
                    <span className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin"></span>
                  )}
                </div>

                <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50">
                  {searchResults.length > 0 ? (
                    searchResults.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          router.push(`/dashboard/creator/${p.id}`)
                          setShowSuggestions(false)
                          setSearchQuery('')
                        }}
                        className="p-3 hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar with luxury border */}
                          <div className="relative flex-shrink-0">
                            {p.avatar_url ? (
                              <img src={p.avatar_url} className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm" alt={p.display_name} />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                {p.display_name ? p.display_name.charAt(0).toUpperCase() : p.email.charAt(0).toUpperCase()}
                              </div>
                            )}
                            {p.is_verified && (
                              <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5 shadow-sm">
                                <CheckCircle size={12} className="text-blue-500 fill-blue-500" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate group-hover:text-accent transition-colors flex items-center gap-1">
                              {p.display_name || 'Sem Nome'}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate mt-0.5">
                              {p.bio || p.email}
                            </p>
                          </div>
                        </div>

                        {/* Interactive View Profile Arrow/Label */}
                        <div className="text-[10px] font-bold text-accent bg-accent/10 px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          Ver Perfil
                        </div>
                      </div>
                    ))
                  ) : (
                    !loadingSearch && (
                      <div className="p-6 text-center text-xs text-gray-400">
                        Nenhum utilizador encontrado para <strong className="text-gray-600">"{searchQuery}"</strong>.
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* User Info & Actions */}
        {user && (
          <div className="flex items-center gap-4">

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={toggleNotif}
                className="relative p-2 text-gray-500 hover:text-accent hover:bg-gray-100 rounded-full transition-colors"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full shadow-sm animate-pulse"></span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border border-border overflow-hidden z-50">
                  <div className="p-3 border-b border-border bg-gray-50 flex justify-between items-center">
                    <p className="font-bold text-sm text-foreground">Notificações</p>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map(notif => (
                        <div key={notif.id} className="p-3 border-b border-gray-50 hover:bg-gray-50 flex gap-3 items-start transition-colors">
                          <div className="mt-1 flex-shrink-0 text-accent">
                            <DollarSign size={16} className="bg-accent/10 rounded-full p-0.5" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-800">{notif.description}</p>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-xs font-bold text-accent">+ AOA {notif.amount?.toLocaleString()}</span>
                              <span className="text-[10px] text-gray-400">{new Date(notif.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm text-gray-500">
                        Nenhuma notificação no momento.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Wallet Button */}
            <button
              onClick={() => router.push('/dashboard?mode=wallet')}
              className="hidden md:flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-full font-bold text-xs transition-all active:scale-95 shadow-lg shadow-accent/20"
            >
              <Wallet size={16} />
              CARTEIRA
            </button>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 hover:bg-gray-50 p-1 pr-2 rounded-full transition-colors border border-transparent focus:border-border"
              >
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold text-foreground">{displayName}</p>
                  <p className="text-[10px] font-bold text-accent">AOA {balance.toLocaleString()}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white font-bold text-xs shadow-md">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-border overflow-hidden z-50">
                  <div className="p-4 border-b border-border bg-gray-50">
                    <p className="font-bold text-sm text-foreground truncate">{displayName}</p>
                    <p className="text-[10px] text-muted-foreground truncate mb-2">{user.email}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Saldo Disponível</p>
                      <p className="text-sm font-black text-accent">AOA {balance.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => { router.push('/dashboard?mode=wallet'); setDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-accent rounded-md transition-colors text-left"
                    >
                      <Wallet size={16} />
                      Minha Carteira
                    </button>
                  </div>
                  <div className="p-2 border-t border-border">
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors">
                      <LogOut size={16} />
                      Terminar Sessão
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <DepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        user={user}
        onSuccess={loadBalance}
      />
    </div>
  )
}
