'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Wallet, ArrowUpRight, X } from 'lucide-react'
import Link from 'next/link'
import { useTheme } from 'next-themes'

export default function WithdrawableAlert() {
  const [withdrawable, setWithdrawable] = useState(0)
  const [showAlert, setShowAlert] = useState(false)
  const [loading, setLoading] = useState(true)
  const { theme } = useTheme()
  const supabase = createClient()

  useEffect(() => {
    async function loadWithdrawable() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Fetch user's balance
        const { data: profile } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', user.id)
          .single()

        if (!profile) return

        // Fetch user's transactions
        const { data: transactions } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)

        if (!transactions) return

        // Calculate withdrawable earnings
        const totalDeposits = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0)
        const totalPurchases = transactions.filter(t => t.type === 'purchase').reduce((s, t) => s + Number(t.amount), 0)
        const unspentDeposits = Math.max(0, totalDeposits - totalPurchases)
        const pendingWithdrawals = transactions.filter(t => t.type === 'withdraw' && t.status === 'pending').reduce((s, t) => s + Number(t.amount), 0)
        const earningsCredits = transactions.filter(t => t.type === 'earnings_credit' && t.status === 'completed').reduce((s, t) => s + Number(t.amount), 0)
        const earningsDebits = transactions.filter(t => t.type === 'earnings_debit' && t.status === 'completed').reduce((s, t) => s + Number(t.amount), 0)
        const withdrawableAmount = Math.max(0, (profile.balance || 0) + earningsCredits - earningsDebits - unspentDeposits - pendingWithdrawals)

        setWithdrawable(withdrawableAmount)
        setShowAlert(withdrawableAmount > 0)
      } catch (error) {
        console.error('Error loading withdrawable:', error)
      } finally {
        setLoading(false)
      }
    }

    loadWithdrawable()
  }, [supabase])

  if (loading || !showAlert || withdrawable <= 0) return null

  return (
    <div className={`rounded-md border p-4 shadow-sm mb-4 animate-in slide-in-from-bottom-2 duration-500 transition-colors duration-300 ${theme === 'dark' ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full flex-shrink-0 ${theme === 'dark' ? 'bg-green-800 text-green-300' : 'bg-green-100 text-green-600'}`}>
          <Wallet size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className={`font-bold text-sm ${theme === 'dark' ? 'text-green-200' : 'text-green-900'}`}>
                Tens ganhos disponíveis para levantar!
              </h4>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-green-300' : 'text-green-800'}`}>
                AOA {withdrawable.toLocaleString()} podem ser levantados para a tua conta bancária.
              </p>
            </div>
            <button
              onClick={() => setShowAlert(false)}
              className={`flex-shrink-0 p-1 rounded-full transition-colors ${theme === 'dark' ? 'text-green-400 hover:text-green-300 hover:bg-green-800' : 'text-green-500 hover:text-green-700 hover:bg-green-100'}`}
            >
              <X size={16} />
            </button>
          </div>
          <Link
            href="/dashboard?mode=wallet&view=withdraw"
            className={`inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg text-xs font-bold transition-all ${theme === 'dark' ? 'bg-green-700 text-white hover:bg-green-600' : 'bg-green-600 text-white hover:bg-green-700'}`}
          >
            <ArrowUpRight size={14} />
            Levantar Agora
          </Link>
        </div>
      </div>
    </div>
  )
}
