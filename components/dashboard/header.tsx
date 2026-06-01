'use client'

import { useState, useRef, useEffect } from 'react'
import { Wallet, DollarSign, LogOut, Bell, Circle, CheckCircle, Globe, Users, Moon, Sun, MessageSquare, Heart } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import DepositModal from './deposit-modal'
import UsersPanel from './users-panel'
import ProfileSetupBanner from './profile-setup-banner'
import { isAdminEmail } from '@/lib/admin-emails'
import { formatMoney, resolveProfileCurrency } from '@/lib/wallet'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { useOnlinePresence } from '@/hooks/use-online-presence'

interface HeaderProps {
  user: any
  onMenuClick?: () => void
}

export default function Header({ user, onMenuClick }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [isDepositOpen, setIsDepositOpen] = useState(false)
  const [depositRequired, setDepositRequired] = useState(false)
  const [usersPanelOpen, setUsersPanelOpen] = useState(false)
  const [lang, setLang] = useState<'PT' | 'EN'>('PT')
  const [langDropdownOpen, setLangDropdownOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)
  const usersPanelRef = useRef<HTMLDivElement>(null)
  const [balance, setBalance] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme } = useTheme()
  useOnlinePresence(user?.id ?? null)

  useEffect(() => setMounted(true), [])

  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [preferredCurrency, setPreferredCurrency] = useState('AOA')
  const [isVerified, setIsVerified] = useState(false)

  

  const loadBalance = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase.from('profiles').select('balance, display_name, avatar_url, phone, preferred_currency, withdrawal_country, is_verified').eq('id', user.id).single()
      if (error) {
        console.error("XoXo Header: Error loading balance from profiles:", error)
      }
      if (data) {
        const val = Number(data.balance);
        setBalance(isNaN(val) ? 0 : val)
        setDisplayName(data.display_name || user.email?.split('@')[0] || 'Usuário')
        setAvatarUrl(data.avatar_url || null)
        setPhone(data.phone || null)
        setPreferredCurrency(resolveProfileCurrency(data))
        setIsVerified(data.is_verified || false)
        console.log('[Header] is_verified:', data.is_verified)
      }
    } catch (err) {
      console.error("XoXo Header: Exception loading balance:", err)
    }
  }

  const loadNotifications = async () => {
    if (!user) return
    // Fetch system notifications (comments, favorites, tips)
    const { data: sysNotifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    // Fetch recent wallet events
    const { data: txnNotifs } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .in('type', ['earnings', 'deposit', 'message'])
      .order('created_at', { ascending: false })
      .limit(10)

    const allNotifs: any[] = [
      ...(sysNotifs || []).map(n => ({ ...n, source: 'system' })),
      ...(txnNotifs || []).map(n => ({ ...n, source: 'transaction' })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    setNotifications(allNotifs)
    const unread = (sysNotifs || []).filter(n => !n.is_read).length
    setUnreadCount(unread)
  }

  useEffect(() => {
    if (!user) return
    loadBalance()
    loadNotifications()

    // Realtime subscription for profile balance updates
        const profileChannelName = `public:profiles:user=${user.id}:${Date.now()}`
        const profileChannel = supabase
          .channel(profileChannelName)
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
        const txnChannelName = `public:transactions:user=${user.id}:${Date.now()}`
        const txnChannel = supabase
          .channel(txnChannelName)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` },
            (_payload) => {
              // Always re-fetch balance from DB to get the authoritative value
              loadBalance();
              // Refresh notifications list
              loadNotifications();
            },
          )
          .subscribe();

    // Realtime subscription for system notifications
        const notifChannelName = `public:notifications:user=${user.id}:${Date.now()}`
        const notifChannel = supabase
          .channel(notifChannelName)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
            () => {
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
    window.addEventListener('profileUpdated', loadBalance)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      window.removeEventListener('balanceUpdated', handleBalanceUpdate)
      window.removeEventListener('profileUpdated', loadBalance)
      document.removeEventListener('mousedown', handleClickOutside)
      supabase.removeChannel(profileChannel)
      supabase.removeChannel(txnChannel)
      supabase.removeChannel(notifChannel)
    }
  }, [user, supabase])

  

  const handleLogout = async () => {
    await fetch('/api/session', { method: 'DELETE' }).catch(() => undefined)
    await supabase.auth.signOut()
    router.push('/')
  }

  const toggleNotif = () => {
    setNotifOpen(!notifOpen)
  }

  const handleLangChange = (newLang: 'PT' | 'EN') => {
    setLang(newLang)
    localStorage.setItem('xoxo_lang', newLang)
    setLangDropdownOpen(false)
    window.dispatchEvent(new Event('languageChanged'))
    alert(newLang === 'PT' ? 'Idioma alterado para Português!' : 'Language changed to English!')
  }

  const showProfileSetup =
    user &&
    !isAdminEmail(user.email) &&
    (!avatarUrl?.trim() || !phone?.trim())

  return (
    <>
    <div className="sticky top-0 z-40 border-b border-border shadow-sm w-full transition-colors duration-300 bg-background">
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
                className="flex items-center gap-1 p-2 rounded-full transition-colors font-bold text-xs text-muted-foreground dark:hover:text-white hover:text-accent hover:bg-accent"
                title="Mudar Idioma / Change Language"
              >
                <Globe size={18} />
                <span className="hidden sm:inline ml-0.5">{lang}</span>
              </button>

              {langDropdownOpen && (
                <div className="absolute right-0 mt-2 w-36 rounded-xl shadow-lg border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 bg-card border-border">
                  <div className="p-1">
                    <button
                      onClick={() => handleLangChange('PT')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors text-left ${lang === 'PT' ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
                    >
                      <span className="text-sm">🇵🇹</span>
                      Português (PT)
                    </button>
                    <button
                      onClick={() => handleLangChange('EN')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors text-left ${lang === 'EN' ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
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
    className="relative p-2 rounded-full transition-colors text-muted-foreground dark:hover:text-white hover:text-accent hover:bg-accent"
    title="Utilizadores"
  >
    <Users size={20} />
  </button>
</div>

            {/* Theme Toggle */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-full transition-colors text-muted-foreground dark:hover:text-white hover:text-accent hover:bg-accent"
                title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            )}

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={toggleNotif}
                className="relative p-2 rounded-full transition-colors text-muted-foreground dark:hover:text-white hover:text-accent hover:bg-accent"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full shadow-sm px-1">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="fixed left-3 right-3 top-[64px] z-50 max-h-[70vh] overflow-hidden rounded-xl border shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 bg-card border-border">
                  <div className="p-3 border-b flex justify-between items-center bg-muted dark:bg-background border-border">
                    <p className="font-bold text-sm text-foreground">Notificações</p>
                  </div>
                  <div className="max-h-[calc(70vh-48px)] overflow-y-auto sm:max-h-[300px]">
                    {notifications.length > 0 ? (
                      notifications.map(notif => {
                        if (notif.source === 'system') {
                          return (
                            <div
                              key={notif.id}
                              onClick={() => {
                                if (notif.post_id) {
                                  router.push(`/dashboard/post/${notif.post_id}`)
                                }
                                if (!notif.is_read) {
                                  fetch('/api/notifications', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: notif.id }),
                                  }).then(() => loadNotifications())
                                }
                              }}
                              className={`p-3 border-b flex gap-3 items-start transition-colors cursor-pointer border-border hover:bg-accent hover:text-accent-foreground ${!notif.is_read ? 'bg-blue-50/50 dark:bg-muted/50' : ''}`}
                            >
                              <div className="mt-1 flex-shrink-0">
                                {notif.type === 'comment' ? (
                                  <MessageSquare size={16} className="text-blue-500" />
                                ) : notif.type === 'favorite' ? (
                                  <Heart size={16} className="text-red-500" />
                                ) : (
                                  <Bell size={16} className="text-accent" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="break-words text-xs font-semibold text-foreground">{notif.title}</p>
                                <p className="break-words text-xs mt-0.5 text-muted-foreground">{notif.message}</p>
                                <span className="text-[10px] mt-1 block text-muted-foreground">{formatRelativeTime(notif.created_at)}</span>
                              </div>
                            </div>
                          )
                        }
                        return (
                          <div key={notif.id} className="p-3 border-b flex gap-3 items-start transition-colors border-border hover:bg-accent hover:text-accent-foreground">
                            <div className="mt-1 flex-shrink-0 text-accent">
                              <DollarSign size={16} className="bg-accent/10 rounded-full p-0.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-sm text-foreground">{notif.description}</p>
                              <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                <span className={`text-xs font-bold ${notif.type === 'message' ? 'text-red-500' : 'text-accent'}`}>
                                  {notif.type === 'message' ? '-' : '+'} AOA {notif.amount?.toLocaleString()}
                                </span>
                                <span className="text-[10px] text-muted-foreground">{formatRelativeTime(notif.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="p-4 text-center text-sm text-muted-foreground">
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
                className="flex items-center gap-3 p-1 pr-2 rounded-full transition-colors border hover:bg-accent border-transparent"
              >
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1">
                    {displayName}
                    {isVerified && <CheckCircle size={12} className="text-blue-500 fill-blue-500" />}
                    {isAdminEmail(user?.email || '') && <span className="text-[8px] font-black bg-accent text-white px-1.5 py-0.5 rounded uppercase tracking-wider">Staff</span>}
                  </p>
                  <p className="text-[10px] font-bold text-accent">{formatMoney(balance, preferredCurrency)}</p>
                </div>
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white font-bold text-xs shadow-md">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  {isVerified && (
                    <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-[1px] shadow-sm">
                      <CheckCircle size={10} className="text-blue-500 fill-blue-500" />
                    </div>
                  )}
                </div>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-md shadow-lg border overflow-hidden z-50 bg-card border-border">
                  <div className="p-4 border-b bg-muted dark:bg-background border-border">
                    <p className="font-bold text-sm truncate text-foreground flex items-center gap-1">
                      {displayName}
                      {isAdminEmail(user?.email || '') && <span className="text-[8px] font-black bg-accent text-white px-1.5 py-0.5 rounded uppercase tracking-wider">Staff</span>}
                    </p>
                    <p className="text-[10px] truncate mb-2 text-muted-foreground">{user.email}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                      <p className="text-[10px] uppercase font-bold tracking-tighter text-muted-foreground">Saldo Disponível</p>
                      <p className="text-sm font-black text-accent">{formatMoney(balance, preferredCurrency)}</p>
                    </div>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => { router.push('/dashboard?mode=wallet'); setDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors text-left text-muted-foreground hover:bg-accent hover:text-accent"
                    >
                      <Wallet size={16} />
                      Minha Carteira
                    </button>
                    <button
                      onClick={() => { setDepositRequired(false); setIsDepositOpen(true); setDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors text-left text-muted-foreground hover:bg-accent hover:text-accent"
                    >
                      <DollarSign size={16} />
                      Depositar (Canal em atualização)
                    </button>
                  </div>
                  <div className="p-2 border-t border-border">
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors text-muted-foreground hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400">
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
        onClose={() => { setIsDepositOpen(false); setDepositRequired(false) }}
        user={user}
        onSuccess={loadBalance}
        required={depositRequired}
      />
    </div>
    {showProfileSetup && (
      <ProfileSetupBanner
        missingAvatar={!avatarUrl?.trim()}
        missingPhone={!phone?.trim()}
      />
    )}
    </>
  )
}
