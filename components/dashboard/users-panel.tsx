'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Search, CheckCircle, Users, X, ArrowRight, Loader2 } from 'lucide-react'
import { isAdminEmail } from '@/lib/admin-emails'

interface UserProfile {
  id: string
  display_name: string | null
  email: string
  avatar_url: string | null
  is_verified: boolean
  bio: string | null
}

interface UsersPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function UsersPanel({ isOpen, onClose }: UsersPanelProps) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch all users on open
  useEffect(() => {
    if (!isOpen) return

    const fetchUsers = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, email, avatar_url, bio, is_verified')
          .order('created_at', { ascending: false })
          .limit(80)

        if (!error && data) {
          const filtered = data.filter((p) => !isAdminEmail(p.email))
          setUsers(filtered)
          setFilteredUsers(filtered)
        }
      } catch (err) {
        console.error('Erro ao carregar utilizadores:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()

    // Focus search input when panel opens
    setTimeout(() => searchInputRef.current?.focus(), 200)
  }, [isOpen, supabase])

  // Filter users based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = users.filter(
      (u) =>
        (u.display_name && u.display_name.toLowerCase().includes(query)) ||
        (u.email && u.email.toLowerCase().includes(query)) ||
        (u.bio && u.bio.toLowerCase().includes(query))
    )
    setFilteredUsers(filtered)
  }, [searchQuery, users])

  const handleUserClick = (userId: string) => {
    router.push(`/dashboard/creator/${userId}`)
    onClose()
    setSearchQuery('')
  }

  if (!isOpen) return null

  return (
    <div
      ref={panelRef}
      className="absolute right-0 mt-2 w-[360px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50"
      style={{
        animation: 'panelSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-accent/5 to-primary/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center">
              <Users size={16} className="text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-gray-900 tracking-tight">
                Utilizadores
              </h3>
              <p className="text-[10px] text-gray-400 font-medium">
                {users.length} encontrados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={14} />
          </button>
        </div>


      </div>

      {/* Users List */}
      <div className="max-h-[380px] overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 size={24} className="animate-spin text-accent" />
            <p className="text-xs text-gray-400 font-medium">A carregar utilizadores...</p>
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="py-1">
            {filteredUsers.map((user, index) => (
              <div
                key={user.id}
                onClick={() => handleUserClick(user.id)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-all group"
                style={{
                  animation: `userFadeIn 0.2s ease-out ${index * 0.03}s both`,
                }}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.display_name || 'User'}
                      className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm group-hover:shadow-md transition-shadow"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center text-white text-sm font-bold shadow-sm group-hover:shadow-md transition-shadow">
                      {user.display_name
                        ? user.display_name.charAt(0).toUpperCase()
                        : user.email.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {user.is_verified && (
                    <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-[2px] shadow-sm">
                      <CheckCircle
                        size={13}
                        className="text-blue-500 fill-blue-500"
                      />
                    </div>
                  )}
                  {/* Online indicator (decorative) */}
                  <div className="absolute top-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate group-hover:text-accent transition-colors flex items-center gap-1.5">
                    {user.display_name || 'Utilizador'}
                    {user.is_verified && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-50 text-[8px] font-black text-blue-600 uppercase tracking-wider">
                        Verificado
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">
                    {user.bio || user.email}
                  </p>
                </div>

                {/* View profile arrow */}
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all">
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-1">
              <Search size={20} className="text-gray-300" />
            </div>
            <p className="text-xs text-gray-400 font-medium">
              Nenhum utilizador encontrado
            </p>
            <p className="text-[10px] text-gray-300">
              Tente pesquisar por outro nome ou email
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 bg-gray-50/50">
        <button
          onClick={() => {
            router.push('/dashboard/explore')
            onClose()
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-accent hover:text-white hover:bg-accent border border-accent/20 hover:border-accent rounded-xl transition-all duration-200"
        >
          <Users size={14} />
          Ver todos os utilizadores
        </button>
      </div>

      {/* Inline keyframe styles */}
      <style jsx>{`
        @keyframes panelSlideIn {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes userFadeIn {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
        </div>
  )
}

UsersPanel.displayName = 'UsersPanel'
