'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Home, Compass, Heart, User, LogOut, Menu, X, Wallet, DollarSign, List, ArrowLeft, PlusCircle, ArrowUpRight, MessageCircle, Radio } from 'lucide-react'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useTheme } from 'next-themes'

function SidebarContent() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const mode = searchParams.get('mode')
  const { theme } = useTheme()

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
    await fetch('/api/session', { method: 'DELETE' }).catch(() => undefined)
    await supabase.auth.signOut()
    router.push('/')
  }

  const socialItems = [
    { label: 'Início', href: '/dashboard', icon: Home },
    { label: 'Chat', href: '/dashboard/messages', icon: MessageCircle },
    { label: 'Stream (Live)', href: '/dashboard/live', icon: Radio },
    { label: 'Reels', href: '/dashboard/reels', icon: Radio, isNew: true },
    { label: 'Explorar', href: '/dashboard/explore', icon: Compass },
    { label: 'Comprados', href: '/dashboard/favorites', icon: Heart },
    { label: 'Meu Perfil', href: '/dashboard/profile', icon: User },
  ]

  const walletItems = [
    { label: 'Início', href: '/dashboard', icon: ArrowLeft },
    { label: 'Saldo', href: '/dashboard?mode=wallet&view=balance', icon: Wallet },
    { label: 'Moeda e Banco', href: '/dashboard?mode=wallet&view=payment-settings', icon: DollarSign },
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
        <div className={`border rounded-md overflow-hidden shadow-sm transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-border'}`}>
          {/* Logo Section */}
          <div className={`px-4 py-5 border-b flex flex-col items-center gap-3 transition-colors duration-300 ${theme === 'dark' ? 'border-gray-700' : 'border-border'}`}>
             <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-accent to-primary p-[2px] shadow-lg">
                <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-muted flex items-center justify-center text-white font-bold text-xl">
                   {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : (profile?.display_name?.charAt(0) || user?.email?.charAt(0) || 'U')}
                </div>
             </div>
             <div className="text-center">
                <h3 className={`font-bold text-sm truncate max-w-[180px] ${theme === 'dark' ? 'text-white' : 'text-foreground'}`}>{profile?.display_name || user?.email?.split('@')[0]}</h3>
                <p className={`text-[10px] font-bold uppercase tracking-tighter ${theme === 'dark' ? 'text-gray-400' : 'text-muted-foreground'}`}>Membro Premium</p>
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
                      : `border-l-2 border-transparent ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700 hover:text-white' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`
                  }`}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                  {(item as any).isNew && (
                    <span className="ml-auto text-red-600 text-xs font-bold">(Novo)</span>
                  )}
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
          <div className={`h-px my-1 transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-700' : 'bg-border'}`} />

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 px-4 py-3 transition-colors w-full text-sm font-medium ${theme === 'dark' ? 'text-gray-400 hover:text-red-400 hover:bg-red-900/30' : 'text-muted-foreground hover:text-destructive hover:bg-destructive/5'}`}
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* Floating Bottom Navigation Bar for Mobile - Rendered via React Portal */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <div className={`fixed bottom-4 left-3 right-3 z-50 mx-auto flex h-16 max-w-md items-center justify-around rounded-[1.75rem] border px-2 shadow-[0_18px_45px_rgba(0,0,0,0.20)] backdrop-blur-xl animate-in slide-in-from-bottom duration-300 transition-colors lg:hidden ${theme === 'dark' ? 'border-gray-700/80 bg-gray-950/90' : 'border-white/70 bg-white/90'}`}>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                title={item.label}
                className={`flex h-12 min-w-0 flex-1 items-center justify-center rounded-2xl transition-all active:scale-95 ${
                  isActive
                    ? 'bg-accent/10 text-accent shadow-inner shadow-accent/5'
                    : `${theme === 'dark' ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-muted-foreground hover:bg-gray-100 hover:text-foreground'}`
                }`}
              >
                <div className="relative">
                  <Icon size={22} className={isActive ? 'text-accent' : theme === 'dark' ? 'text-gray-400' : 'text-muted-foreground'} />
                  {item.label === 'Chat' && unreadGlobalCount > 0 && (
                    <span className="absolute -top-2 -right-2 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-accent px-1 text-[8px] font-black text-white shadow-sm animate-in zoom-in duration-300">
                      {unreadGlobalCount}
                    </span>
                  )}
                  {item.label === 'Stream (Live)' && activeStreamsCount > 0 && (
                    <span className="absolute -top-2 -right-5 flex items-center gap-0.5 rounded-full bg-red-600 px-1 text-[7px] font-extrabold text-white shadow-sm animate-pulse">
                      <span className="w-0.5 h-0.5 bg-white rounded-full animate-ping" />
                      HOT ({activeStreamsCount})
                    </span>
                  )}
                </div>
              </Link>
            )
          })}

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
