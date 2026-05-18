'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Home, Compass, Heart, User, LogOut, Menu, X, Wallet, DollarSign, List, ArrowLeft, PlusCircle, ArrowUpRight, MessageCircle, Radio } from 'lucide-react'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'

function SidebarContent() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const mode = searchParams.get('mode')

  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [unreadGlobalCount, setUnreadGlobalCount] = useState(0)
  const [activeStreamsCount, setActiveStreamsCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => setProfile(data))
      }
    })
  }, [supabase])

  useEffect(() => {
    if (!user) return

    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false)
      
      setUnreadGlobalCount(count || 0)
    }

    fetchUnreadCount()

    // Listen for new messages or message updates in real-time
    const channel = supabase
      .channel('sidebar_unread_messages')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, () => {
        fetchUnreadCount()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, supabase])

  useEffect(() => {
    if (!user) return

    const fetchActiveStreamsCount = async () => {
      const { count } = await supabase
        .from('live_streams')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
      
      setActiveStreamsCount(count || 0)
    }

    fetchActiveStreamsCount()

    // Subscribe to live streams table changes in real-time
    const streamsChannel = supabase
      .channel('sidebar_active_streams')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_streams'
      }, () => {
        fetchActiveStreamsCount()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(streamsChannel)
    }
  }, [user, supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const socialItems = [
    { label: 'Início', href: '/dashboard', icon: Home },
    { label: 'Chat', href: '/dashboard/messages', icon: MessageCircle },
    { label: 'Stream (Live)', href: '/dashboard/live', icon: Radio },
    { label: 'Explorar', href: '/dashboard/explore', icon: Compass },
    { label: 'Favoritos', href: '/dashboard/favorites', icon: Heart },
    { label: 'Meu Perfil', href: '/dashboard/profile', icon: User },
  ]

  const walletItems = [
    { label: 'Início', href: '/dashboard', icon: ArrowLeft },
    { label: 'Saldo', href: '/dashboard?mode=wallet&view=balance', icon: Wallet },
    { label: 'Depósito', href: '/dashboard?mode=wallet&view=deposit', icon: PlusCircle },
    { label: 'Levantamento', href: '/dashboard?mode=wallet&view=withdraw', icon: ArrowUpRight },
    { label: 'Transações', href: '/dashboard?mode=wallet&view=transactions', icon: List },
  ]

  const navItems = mode === 'wallet' ? walletItems : socialItems

  return (
    <>
      {/* Sidebar Content (Desktop only) */}
      <div className="hidden lg:block sticky top-24">
        {/* Profile Card / Main Nav Card */}
        <div className="bg-white border border-border rounded-md overflow-hidden shadow-sm">
          {/* Logo Section */}
          <div className="px-4 py-5 border-b border-border flex flex-col items-center gap-3">
             <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-accent to-primary p-[2px] shadow-lg">
                <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-muted flex items-center justify-center text-white font-bold text-xl">
                   {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : (profile?.display_name?.charAt(0) || user?.email?.charAt(0) || 'U')}
                </div>
             </div>
             <div className="text-center">
                <h3 className="font-bold text-sm text-foreground truncate max-w-[180px]">{profile?.display_name || user?.email?.split('@')[0]}</h3>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Membro Premium</p>
             </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col py-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    isActive
                      ? 'border-l-2 border-accent bg-accent/5 text-accent font-semibold'
                      : 'border-l-2 border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.label === 'Chat' && unreadGlobalCount > 0 && (
                    <span className="ml-auto bg-accent text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                      {unreadGlobalCount}
                    </span>
                  )}
                  {item.label === 'Stream (Live)' && activeStreamsCount > 0 && (
                    <span className="ml-auto bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg animate-pulse uppercase tracking-wider">
                      <span className="w-1 h-1 bg-white rounded-full animate-ping" />
                      HOT ({activeStreamsCount})
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Divider */}
          <div className="h-px bg-border my-1" />

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors w-full text-sm font-medium"
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* Sleek Fixed Bottom Navigation Bar for Mobile (WhatsApp-style) - Rendered via React Portal */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.06)] px-1 py-1.5 flex items-center justify-around h-16 pb-safe animate-in slide-in-from-bottom duration-300">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                  isActive
                    ? 'text-accent font-bold scale-105'
                    : 'text-muted-foreground active:scale-95 hover:text-foreground'
                }`}
              >
                <div className="relative">
                  <Icon size={20} className={isActive ? 'text-accent' : 'text-muted-foreground'} />
                  {item.label === 'Chat' && unreadGlobalCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-accent text-white text-[8px] font-black min-w-[14px] h-[14px] px-1 rounded-full flex items-center justify-center shadow-sm animate-in zoom-in duration-300">
                      {unreadGlobalCount}
                    </span>
                  )}
                  {item.label === 'Stream (Live)' && activeStreamsCount > 0 && (
                    <span className="absolute -top-2 -right-4 bg-red-600 text-white text-[7px] font-extrabold px-1 rounded-full shadow-sm animate-pulse flex items-center gap-0.5">
                      <span className="w-0.5 h-0.5 bg-white rounded-full animate-ping" />
                      HOT ({activeStreamsCount})
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-1 font-semibold tracking-tight truncate max-w-[64px]">{item.label}</span>
              </Link>
            )
          })}

          {/* Append 'Sair' button on mobile if not in wallet mode for 6-grid consistency */}
          {mode !== 'wallet' && (
            <button
              onClick={handleLogout}
              className="flex flex-col items-center justify-center flex-1 py-1 text-muted-foreground hover:text-destructive active:scale-95 transition-all"
            >
              <LogOut size={20} />
              <span className="text-[10px] mt-1 font-semibold tracking-tight">Sair</span>
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

export default function Sidebar() {
  return (
    <Suspense fallback={<div className="hidden lg:block w-[225px] h-96 bg-gray-50 border border-border rounded-md animate-pulse" />}>
      <SidebarContent />
    </Suspense>
  )
}
