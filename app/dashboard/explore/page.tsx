'use client'

import Sidebar from '@/components/dashboard/sidebar'
import { Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function ExplorePage() {
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })
  }, [supabase])

  return (
    <div className="min-h-screen bg-background">
      {/* Global Top Navbar */}
      <div className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="max-w-[1128px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-accent lg:hidden">XoXo</h2>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#f3f2ef] border border-border w-64 transition-all focus-within:w-80">
              <Search size={16} className="text-gray-500 flex-shrink-0" />
              <input
                type="text"
                placeholder="Pesquisar..."
                className="w-full bg-transparent text-sm outline-none placeholder-gray-500 text-gray-900"
              />
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-medium text-foreground">{user.email}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white font-bold text-xs">
                {user.email?.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar + Main Content */}
      <div className="max-w-[1128px] mx-auto flex justify-center gap-6 pt-6 px-4">
        {/* Left Sidebar */}
        <div className="hidden lg:block w-[225px] flex-shrink-0">
          <Sidebar />
        </div>

        {/* Main Content */}
        <div className="flex-1 max-w-2xl w-full">
          <div className="bg-white border border-border rounded-md p-8 text-center shadow-sm w-full">
            <Search size={48} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Explorar</h2>
            <p className="text-gray-500 text-sm">Página em construção. Em breve poderá descobrir novos criadores aqui.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
