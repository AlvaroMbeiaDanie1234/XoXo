'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Sidebar from '@/components/dashboard/sidebar'
import PostCard from '@/components/dashboard/post-card'
import Header from '@/components/dashboard/header'
import CreatePostModal from '@/components/dashboard/create-post-modal'
import SuggestedCreators from '@/components/dashboard/suggested-creators'
import WithdrawableAlert from '@/components/dashboard/withdrawable-alert'
import ConsentModal from '@/components/dashboard/consent-modal'
import {
  Search, Wallet, PlusCircle, List, ArrowLeft, Loader2,
  CheckCircle2, ExternalLink, ArrowUpRight, ArrowDownLeft,
  Banknote, Building2, Send, Megaphone, X
} from 'lucide-react'
import { Suspense } from 'react'
import WalletPreferences from '@/components/dashboard/wallet-preferences'
import { useTheme } from 'next-themes'
import {
  formatMoney,
  bankDetailsFromProfile,
  buildWithdrawalDescription,
  isBankDetailsComplete,
  getCurrencyOption,
  minDepositForCurrency,
  getDepositPresets,
  formatBankSummary,
  getCountryByCode,
  resolveProfileCurrency,
  type WithdrawalCountryCode,
} from '@/lib/wallet'

interface Post {
  id: string
  title: string
  description: string
  content_type: 'video' | 'article' | 'photo'
  content_url: string
  thumbnail_url: string
  created_at: string
  user_id: string
  price?: number
  is_free?: boolean
  profiles?: {
    display_name: string | null
    avatar_url: string | null
    is_verified?: boolean
  }
}

function DashboardContent() {
  const [posts, setPosts] = useState<Post[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [dashboardAnnouncements, setDashboardAnnouncements] = useState<any[]>([])
  const [dismissedAnns, setDismissedAnns] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [balance, setBalance] = useState(0)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [minWithdrawAmount, setMinWithdrawAmount] = useState(1000)
  const { theme } = useTheme()
  
  // Infinite scroll states
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const POSTS_PER_PAGE = 10
  
  // Wallet states
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawPhone, setWithdrawPhone] = useState('')
  const [depositLoading, setDepositLoading] = useState(false)
  const [depositSuccess, setDepositSuccess] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')
  const view = searchParams.get('view')

  const preferredCurrency = resolveProfileCurrency(userProfile)
  const withdrawalCountry = (userProfile?.withdrawal_country || 'AO') as WithdrawalCountryCode
  const bankDetails = bankDetailsFromProfile(userProfile)
  const currencyOpt = getCurrencyOption(preferredCurrency)
  const bankComplete = isBankDetailsComplete(withdrawalCountry, bankDetails)
  const depositPresets = getDepositPresets(preferredCurrency)
  const minDeposit = minDepositForCurrency(preferredCurrency)

  const reloadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) {
      setUserProfile(data)
      setBalance(Number(data.balance) || 0)
    }
  }

  const loadMorePosts = async () => {
    if (!hasMore || loadingMore || !user) return
    
    setLoadingMore(true)
    try {
      const from = page * POSTS_PER_PAGE
      const to = from + POSTS_PER_PAGE - 1
      
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*, profiles(display_name, avatar_url)')
        .order('created_at', { ascending: false })
        .range(from, to)

      if (postsError) throw postsError
      
      if (postsData && postsData.length > 0) {
        setPosts(prev => [...prev, ...postsData])
        setPage(prev => prev + 1)
        setHasMore(postsData.length >= POSTS_PER_PAGE)
      } else {
        setHasMore(false)
      }
    } catch (err: any) {
      console.error('Error loading more posts:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    // Setup infinite scroll observer
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMorePosts()
        }
      },
      { threshold: 0.1 }
    )

    const sentinel = document.getElementById('infinite-scroll-sentinel')
    if (sentinel) {
      observer.observe(sentinel)
    }

    return () => {
      if (sentinel) {
        observer.unobserve(sentinel)
      }
    }
  }, [hasMore, loadingMore, page, user])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (!currentUser) {
          router.push('/')
          return
        }
        setUser(currentUser)

        // Fetch User Profile
        const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single()
        if (profileError) {
          console.error("XoXo Dashboard: Error fetching user profile:", profileError)
        }
        if (profile) {
          const val = Number(profile.balance);
          setBalance(isNaN(val) ? 0 : val)
          setUserProfile(profile)
        }

        if (searchParams.get('status') === 'success') {
          setDepositSuccess(true)
        }

        // Fetch active announcements
        const { data: annData } = await supabase
          .from('system_announcements')
          .select('*')
          .or(`target_user_id.is.null,target_user_id.eq.${currentUser.id}`)
          .order('created_at', { ascending: false })
        if (annData) setDashboardAnnouncements(annData)

        // Fetch min withdraw amount setting
        const { data: settings } = await supabase.from('system_settings').select('*').eq('key', 'min_withdraw_amount').single()
        if (settings) setMinWithdrawAmount(Number(settings.value) || 1000)

        if (mode === 'wallet') {
          // Fetch Transactions
          const { data: transData } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
          if (transData) setTransactions(transData)
        } else {
          // Fetch posts with pagination
          const { data: postsData, error: postsError } = await supabase
            .from('posts')
            .select('*, profiles(display_name, avatar_url)')
            .order('created_at', { ascending: false })
            .range(0, POSTS_PER_PAGE - 1)

          if (postsError) throw postsError
          setPosts(postsData || [])
          setHasMore((postsData?.length || 0) >= POSTS_PER_PAGE)
          setPage(1)
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar conteúdo')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase, router, mode, view])

  const handleFlutterwaveDeposit = async () => {
    const minDep = minDepositForCurrency(preferredCurrency)
    if (!depositAmount || parseFloat(depositAmount) < minDep) {
      alert(`O valor mínimo de depósito é ${formatMoney(minDep, preferredCurrency)}`)
      return
    }
    setDepositLoading(true)
    try {
      const res = await fetch('/api/payments/flutterwave/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(depositAmount),
          currency: preferredCurrency,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao iniciar pagamento')
      window.location.href = data.link
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao depositar')
    } finally {
      setDepositLoading(false)
    }
  }

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return

    if (!isBankDetailsComplete(withdrawalCountry, bankDetails)) {
      alert('Completa os teus dados bancários em Moeda e Banco antes de solicitar levantamento.')
      router.push('/dashboard?mode=wallet&view=payment-settings')
      return
    }

    const amount = parseFloat(withdrawAmount)

    if (amount < minWithdrawAmount) {
      return alert(`O valor mínimo de levantamento é AOA ${minWithdrawAmount.toLocaleString()}.`)
    }

    const totalDeposits = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0)
    const totalPurchases = transactions.filter(t => t.type === 'purchase').reduce((s, t) => s + Number(t.amount), 0)
    const unspentDeposits = Math.max(0, totalDeposits - totalPurchases)
    const pendingWithdrawals = transactions.filter(t => t.type === 'withdraw' && t.status === 'pending').reduce((s, t) => s + Number(t.amount), 0)
    const withdrawable = Math.max(0, balance - unspentDeposits - pendingWithdrawals)

    if (amount > withdrawable) {
      return alert('Saldo insuficiente para levantamento! Apenas ganhos podem ser levantados.')
    }

    setIsProcessing(true)
    try {
      const description = buildWithdrawalDescription(
        withdrawalCountry,
        bankDetails,
        preferredCurrency
      )

      // Update phone number if provided
      if (withdrawPhone && withdrawPhone !== userProfile?.phone) {
        await supabase.from('profiles').update({ phone: withdrawPhone }).eq('id', user.id)
      }

      // Deduct amount from balance immediately (cativar valor)
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ balance: balance - amount })
        .eq('id', user.id)

      if (balanceError) throw balanceError

      await supabase.from('transactions').insert({
        user_id: user.id,
        amount: amount,
        type: 'withdraw',
        description,
        status: 'pending',
      })

      const { data: profile } = await supabase.from('profiles').select('balance, phone').eq('id', user.id).single()
      if (profile) {
        setBalance(Number(profile.balance) || 0)
        setUserProfile(prev => ({ ...prev, phone: profile.phone }))
      }

      fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          body: `O seu pedido de levantamento de ${formatMoney(amount, preferredCurrency)} foi submetido e está pendente de aprovação.`,
        }),
      }).catch(console.warn)

      setWithdrawAmount('')
      alert('Pedido de levantamento enviado com sucesso! Será processado em breve.')
      router.push('/dashboard?mode=wallet&view=transactions')
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900' : 'bg-background'}`}>
      <Header user={user} />
      
      <div className={`max-w-[1128px] mx-auto flex justify-center gap-6 pt-6 px-4 ${mode === 'wallet' ? 'flex-col lg:flex-row' : ''}`}>
        <div className="hidden lg:block w-[225px] flex-shrink-0">
          <Sidebar />
        </div>

        <div className="flex-1 max-w-[800px] w-full min-h-[80vh]">
          {mode === 'wallet' ? (
            <div className="space-y-6">
              {view === 'balance' || !view ? (
                <div className={`rounded-xl border overflow-hidden shadow-sm transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-border'}`}>
                  <div className="bg-accent p-10 text-white">
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-3">
                      <Wallet /> Saldo Disponível (Para Compras)
                    </h2>
                    <p className="text-5xl font-black tracking-tighter">{formatMoney(balance, preferredCurrency)}</p>
                  </div>
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-100'}`}>
                      <div className="flex items-center gap-3 mb-2 text-green-600">
                        <ArrowDownLeft size={20} />
                        <p className="text-xs font-bold uppercase tracking-widest">Ganhos (A Levantar)</p>
                      </div>
                      <p className={`text-2xl font-black ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>
                        {formatMoney(
                          (() => {
                            const totalDeposits = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0)
                            const totalPurchases = transactions.filter(t => t.type === 'purchase').reduce((s, t) => s + Number(t.amount), 0)
                            const unspentDeposits = Math.max(0, totalDeposits - totalPurchases)
                            return Math.max(0, balance - unspentDeposits)
                          })(),
                          preferredCurrency
                        )}
                      </p>
                    </div>
                    <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-100'}`}>
                      <div className="flex items-center gap-3 mb-2 text-red-600">
                        <ArrowUpRight size={20} />
                        <p className="text-xs font-bold uppercase tracking-widest">Despesas</p>
                      </div>
                      <p className={`text-2xl font-black ${theme === 'dark' ? 'text-red-400' : 'text-red-700'}`}>
                        {formatMoney(
                          transactions.filter(t => t.type === 'purchase').reduce((s, t) => s + Number(t.amount), 0),
                          preferredCurrency
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ) : view === 'payment-settings' ? (
                user && (
                  <WalletPreferences
                    profile={userProfile}
                    userId={user.id}
                    onSaved={() => reloadProfile(user.id)}
                  />
                )
              ) : view === 'deposit' ? (
                <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-border">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <PlusCircle className="text-accent" /> Carregar Carteira
                    </h2>
                  </div>
                  
                  <div className="p-8">
                    <div className="max-w-md mx-auto space-y-6">
                      {searchParams.get('required') === '1' && (
                        <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-800 font-medium text-center">
                          Atingiste o limite gratuito (3 publicações, 3 mensagens, 3 comentários). Realiza um depósito para continuar.
                        </div>
                      )}
                      {depositSuccess && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 font-medium text-center flex items-center justify-center gap-2">
                          <CheckCircle2 size={18} /> Pagamento recebido! O saldo será atualizado em breve.
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Pagamento seguro via Flutterwave</p>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-lg">
                            {currencyOpt.symbol}
                          </span>
                          <input
                            type="number"
                            min={minDeposit}
                            placeholder={`Mín. ${minDeposit}`}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 pl-16 pr-6 outline-none focus:border-accent text-2xl font-black text-center"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                          />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2">
                          Moeda: <strong>{preferredCurrency}</strong> (definida pelo país em{' '}
                          <button
                            type="button"
                            onClick={() => router.push('/dashboard?mode=wallet&view=payment-settings')}
                            className="text-accent font-bold hover:underline"
                          >
                            Moeda e Banco
                          </button>
                          )
                        </p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {depositPresets.map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setDepositAmount(val)}
                            className="py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:border-accent hover:text-accent"
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                      <button 
                        onClick={handleFlutterwaveDeposit}
                        disabled={depositLoading || !depositAmount}
                        className="w-full bg-accent text-white py-4 rounded-xl font-bold text-base shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {depositLoading ? <Loader2 className="animate-spin" size={20} /> : <ExternalLink size={18} />}
                        Pagar com Flutterwave
                      </button>
                      <p className="text-[10px] text-center text-gray-400">
                        Aceita Multicaixa, cartão e outros métodos disponíveis na Flutterwave.
                      </p>
                    </div>
                  </div>
                </div>
              ) : view === 'withdraw' ? (
                <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-border bg-orange-50/30">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Banknote className="text-orange-600" /> Levantamento de Dinheiro
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Saques para Angola, Brasil e Moçambique ({preferredCurrency}). O valor será
                      creditado na conta bancária configurada em Moeda e Banco.
                    </p>
                  </div>
                  <div className="p-8">
                    <div className="max-w-md mx-auto space-y-6">
                      <div className="bg-gray-50 p-4 rounded-xl border border-border flex justify-between items-center">
                        <span className="text-sm text-gray-500">Saldo Disponível</span>
                        <span className="font-bold text-gray-900">{formatMoney(balance, preferredCurrency)}</span>
                      </div>

                      {!bankComplete ? (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
                          <p className="font-bold mb-1">Dados bancários em falta</p>
                          <p className="text-xs mb-3">
                            Guarda o teu nome, banco e IBAN/conta em Moeda e Banco antes de solicitar levantamento.
                          </p>
                          <button
                            type="button"
                            onClick={() => router.push('/dashboard?mode=wallet&view=payment-settings')}
                            className="text-xs font-bold text-accent hover:underline"
                          >
                            Configurar agora →
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 bg-white border border-border rounded-xl space-y-1">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Building2 size={14} /> Conta de recebimento
                          </p>
                          {formatBankSummary(withdrawalCountry, bankDetails).map((line) => (
                            <p key={line} className="text-sm text-gray-800">{line}</p>
                          ))}
                          <button
                            type="button"
                            onClick={() => router.push('/dashboard?mode=wallet&view=payment-settings')}
                            className="text-xs font-bold text-accent mt-2 hover:underline"
                          >
                            Editar dados bancários
                          </button>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                          Valor a levantar ({preferredCurrency})
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">
                            {currencyOpt.symbol}
                          </span>
                          <input
                            type="number"
                            placeholder="0"
                            min={0}
                            className="w-full bg-gray-50 border border-border rounded-xl py-3 pl-14 pr-4 outline-none focus:border-accent font-bold"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                          Telefone para notificação (opcional)
                        </label>
                        <input
                          type="tel"
                          placeholder={userProfile?.phone || 'Número de telefone'}
                          className="w-full bg-gray-50 border border-border rounded-xl py-3 px-4 outline-none focus:border-accent font-bold text-sm"
                          value={withdrawPhone}
                          onChange={(e) => setWithdrawPhone(e.target.value)}
                        />
                        <p className="text-[10px] text-gray-400 mt-1">
                          Atualiza o teu número de telefone para receber notificações sobre este levantamento.
                        </p>
                      </div>

                      <button 
                        onClick={handleWithdraw}
                        disabled={isProcessing || !withdrawAmount || !bankComplete}
                        className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-orange-100 flex items-center justify-center gap-2 disabled:opacity-40"
                      >
                        {isProcessing ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                        Solicitar Levantamento
                      </button>
                      <p className="text-[10px] text-center text-gray-400">
                        Processamento em até 24h úteis. País: {getCountryByCode(withdrawalCountry)?.name}.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-border">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <List className="text-accent" /> Histórico de Transações
                    </h2>
                  </div>
                  <div className="divide-y divide-border">
                    {transactions.length > 0 ? (
                      transactions.map((t) => (
                        <div key={t.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${
                              t.type === 'deposit' || t.type === 'earnings' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                            }`}>
                              {t.type === 'deposit' ? <PlusCircle size={18} /> : t.type === 'earnings' ? <ArrowDownLeft size={18} /> : t.type === 'withdraw' ? <Banknote size={18} /> : <ArrowUpRight size={18} />}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-gray-900 line-clamp-1">{t.description}</p>
                              <p className="text-[10px] text-gray-400 uppercase font-medium">{new Date(t.created_at).toLocaleString()} • {t.type}</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`font-bold text-sm ${t.type === 'deposit' || t.type === 'earnings' ? 'text-green-600' : 'text-red-600'}`}>
                              {t.type === 'deposit' || t.type === 'earnings' ? '+' : '-'}{' '}
                              {formatMoney(Number(t.amount), preferredCurrency)}
                            </p>
                            <p className="text-[9px] uppercase font-black text-gray-400 tracking-tighter">{t.status}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-12 text-center text-gray-400 italic">Ainda não existem transações registadas.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Comunicados Oficiais */}
              {dashboardAnnouncements
                .filter(a => a.type === 'comunicado' && !dismissedAnns.includes(a.id))
                .map((a) => (
                  <div key={a.id} className={`rounded-xl p-5 mb-4 shadow-sm relative flex gap-4 animate-in fade-in duration-300 ${theme === 'dark' ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'}`}>
                    <div className={`p-3 rounded-xl w-12 h-12 flex items-center justify-center flex-shrink-0 ${theme === 'dark' ? 'bg-blue-800 text-blue-300' : 'bg-blue-100 text-blue-600'}`}>
                       <Megaphone size={22} />
                    </div>
                    <div className="flex-1 pr-6">
                      <h4 className={`font-extrabold text-base mb-1 ${theme === 'dark' ? 'text-blue-200' : 'text-blue-900'}`}>{a.title}</h4>
                      <p className={`text-xs leading-relaxed whitespace-pre-wrap ${theme === 'dark' ? 'text-blue-300' : 'text-blue-800'}`}>{a.content}</p>
                      {a.image_url && (
                        <img src={a.image_url} alt="anuncio" className="max-h-48 rounded-xl object-cover mt-3 border border-blue-100" />
                      )}
                    </div>
                    <button
                      onClick={() => setDismissedAnns([...dismissedAnns, a.id])}
                      className={`absolute top-4 right-4 transition-colors ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-400 hover:text-blue-600'}`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}

              {/* Withdrawable Alert */}
              <WithdrawableAlert />

              {/* Feed Logic Same as Before */}
              <div className={`rounded-md p-4 mb-4 shadow-sm w-full transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-border'}`}>
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-accent to-primary p-[2px] shadow-sm flex-shrink-0">
                    <div className="w-full h-full rounded-full border border-white overflow-hidden bg-muted flex items-center justify-center text-white font-bold text-lg">
                      {userProfile?.avatar_url ? (
                         <img src={userProfile.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                         (userProfile?.display_name?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className={`flex-1 text-left transition-colors rounded-full px-5 py-3 text-sm font-medium border ${theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border-gray-600' : 'bg-[#f3f2ef] text-gray-600 hover:bg-gray-200 border-border'}`}
                  >
                    O que vais publicar hoje, {userProfile?.display_name || user?.email?.split('@')[0]}?
                  </button>
                </div>
              </div>

              <CreatePostModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} user={user} />

              {loading ? (
                <div className="flex flex-col gap-4 w-full">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-[400px] bg-gray-200 rounded-md animate-pulse border border-border" />)}
                </div>
              ) : (
                <div className="flex flex-col gap-4 w-full overflow-visible">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      {...post}
                      creator_name={post.profiles?.display_name || 'Usuário'}
                      creator_avatar={post.profiles?.avatar_url || undefined}
                      creator_verified={false}
                      creator_id={post.user_id}
                    />
                  ))}
                  {hasMore && (
                    <div id="infinite-scroll-sentinel" className="flex items-center justify-center py-8">
                      {loadingMore && <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {mode !== 'wallet' && (
          <div className="hidden xl:block w-[300px] flex-shrink-0 space-y-6">

            {/* Anúncios / Publicidade (Ads) */}
            {dashboardAnnouncements
              .filter(a => a.type === 'anuncio')
              .map((a) => (
                <div key={a.id} className={`rounded-2xl shadow-md p-5 overflow-hidden flex flex-col justify-between hover:shadow-lg transition-shadow ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-border'}`}>
                  <div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${theme === 'dark' ? 'bg-purple-900/30 text-purple-300 border-purple-800' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                      Publicidade / Anúncio
                    </span>
                    <h4 className={`font-extrabold text-sm mt-3 mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{a.title}</h4>
                    <p className={`text-xs leading-relaxed whitespace-pre-wrap ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{a.content}</p>
                    {a.image_url && (
                      <img src={a.image_url} alt="ads" className="w-full h-32 rounded-xl object-cover mt-3 border border-gray-100 shadow-sm" />
                    )}
                  </div>
                  {a.link_url && (
                    <a
                      href={a.link_url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full text-center bg-gray-900 hover:bg-black text-white font-bold py-2 rounded-xl text-xs transition-colors mt-4 block"
                    >
                      Saber Mais
                    </a>
                  )}
                </div>
              ))}

            <SuggestedCreators />
          </div>
        )}
      </div>

      <ConsentModal />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="animate-spin text-accent" /></div>}>
      <DashboardContent />
    </Suspense>
  )
}
