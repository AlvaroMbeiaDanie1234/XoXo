'use client'

import { useState, useRef, useEffect } from 'react'
import { Wallet, DollarSign, LogOut, Bell, Circle, CheckCircle, Globe, Users } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import DepositModal from './deposit-modal'
import UsersPanel from './users-panel'

interface HeaderProps {
  user: any
  onMenuClick?: () => void
}

export default function Header({ user, onMenuClick }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const [usersPanelOpen, setUsersPanelOpen] = useState(false)
  const [lang, setLang] = useState<'PT' | 'EN'>('PT')
  const [langDropdownOpen, setLangDropdownOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)
  const usersPanelRef = useRef<HTMLDivElement>(null)
  const [balance, setBalance] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const [displayName, setDisplayName] = useState('')

  

  const loadBalance = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase.from('profiles').select('balance, display_name').eq('id', user.id).single()
      if (error) {
        console.error("XoXo Header: Error loading balance from profiles:", error)
      }
      if (data) {
        const val = Number(data.balance);
        setBalance(isNaN(val) ? 0 : val)
        setDisplayName(data.display_name || user.email?.split('@')[0] || 'Usuário')
      }
    } catch (err) {
      console.error("XoXo Header: Exception loading balance:", err)
    }
  }

  const loadNotifications = async () => {
    if (!user) return
    // Fetch recent earnings (sales) and deposits as notifications
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .in('type', ['earnings', 'deposit'])
      .order('created_at', { ascending: false })
      .limit(5)

    if (data) {
      setNotifications(data)
      setUnreadCount(data.length > 0 ? 1 : 0) // Show red dot if any notifications
    }
  }

  useEffect(() => {
    if (!user) return
    loadBalance()
    loadNotifications()

    // Realtime subscription for profile balance updates
    const profileChannel = supabase
      .channel('public:profiles')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          // Update balance from payload if present, otherwise reload
          if (payload.new && payload.new.balance !== undefined && payload.new.balance !== null) {
            const val = Number(payload.new.balance);
            setBalance(isNaN(val) ? 0 : val);
          } else {
            loadBalance();
          }
        },
      )
      .subscribe();

    // Realtime subscription for new transaction notifications (deposits/earnings)
        const txnChannel = supabase
          .channel(`public:transactions:user=${user.id}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` },
            (payload) => {
              // If the payload includes an amount, increment balance locally
              if (payload.new && payload.new.amount !== undefined && payload.new.amount !== null) {
                const val = Number(payload.new.amount);
                setBalance((prev) => prev + (isNaN(val) ? 0 : val));
              } else {
                loadBalance();
              }
              // Refresh notifications list
              loadNotifications();
            },
          )
          .subscribe();

    const handleBalanceUpdate = () => {
      loadBalance()
      loadNotifications()
    }

    if (typeof window !== 'undefined') {
      const storedLang = localStorage.getItem('xoxo_lang') as 'PT' | 'EN'
      if (storedLang) setLang(storedLang)
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setDropdownOpen(false)
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setNotifOpen(false)
      if (langRef.current && !langRef.current.contains(event.target as Node)) setLangDropdownOpen(false)
      if (usersPanelRef.current && !usersPanelRef.current.contains(event.target as Node)) setUsersPanelOpen(false)
    }

    window.addEventListener('balanceUpdated', handleBalanceUpdate)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      window.removeEventListener('balanceUpdated', handleBalanceUpdate)
      document.removeEventListener('mousedown', handleClickOutside)
      supabase.removeChannel(profileChannel)
      supabase.removeChannel(txnChannel)
    }
  }, [user, supabase])

  

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const toggleNotif = () => {
    setNotifOpen(!notifOpen)
    if (!notifOpen) setUnreadCount(0)
  }

  const handleLangChange = (newLang: 'PT' | 'EN') => {
    setLang(newLang)
    localStorage.setItem('xoxo_lang', newLang)
    setLangDropdownOpen(false)
    window.dispatchEvent(new Event('languageChanged'))
    alert(newLang === 'PT' ? 'Idioma alterado para Português!' : 'Language changed to English!')
  }

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-border shadow-sm w-full">
      <div className="max-w-[1128px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-xl font-bold text-accent">XoXo</Link>
        </div>

        {/* User Info & Actions */}
        {user && (
          <div className="flex items-center gap-4">

            {/* Language Selector Dropdown */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="flex items-center gap-1 p-2 text-gray-500 hover:text-accent hover:bg-gray-100 rounded-full transition-colors font-bold text-xs"
                title="Mudar Idioma / Change Language"
              >
                <Globe size={18} />
                <span className="hidden sm:inline ml-0.5">{lang}</span>
              </button>

              {langDropdownOpen && (
                <div className="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-lg border border-border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-1">
                    <button
                      onClick={() => handleLangChange('PT')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors text-left ${lang === 'PT' ? 'bg-accent/10 text-accent' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                      <span className="text-sm">🇵🇹</span>
                      Português (PT)
                    </button>
                    <button
                      onClick={() => handleLangChange('EN')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors text-left ${lang === 'EN' ? 'bg-accent/10 text-accent' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                      <span className="text-sm">🇬🇧</span>
                      English (EN)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Users Panel */}
            <div className="relative" ref={usersPanelRef}>
  <button
    onClick={() => router.push('/dashboard/explore')}
    className="relative p-2 rounded-full text-gray-500 hover:text-accent hover:bg-gray-100"
    title="Utilizadores"
  >
    <Users size={20} />
  </button>
</div>

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
