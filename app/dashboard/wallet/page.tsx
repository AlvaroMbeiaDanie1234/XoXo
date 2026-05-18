'use client'

import Sidebar from '@/components/dashboard/sidebar'
import Header from '@/components/dashboard/header'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function WalletPage() {
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [supabase])

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      <div className="max-w-[1128px] mx-auto flex justify-center gap-6 pt-6 px-4">
        <div className="hidden lg:block w-[225px] flex-shrink-0">
          <Sidebar />
        </div>
        <div className="flex-1 max-w-2xl w-full">
          <div className="bg-white border border-border rounded-md p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-foreground mb-4">Minha Carteira</h2>
            <p className="text-muted-foreground">Adicione saldo e gira a sua carteira digital.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
