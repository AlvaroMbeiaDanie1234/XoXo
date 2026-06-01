'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Sidebar from '@/components/dashboard/sidebar'
import PostCard from '@/components/dashboard/post-card'
import Header from '@/components/dashboard/header'
import CreatePostModal from '@/components/dashboard/create-post-modal'
import SuggestedCreators from '@/components/dashboard/suggested-creators'
import { formatRelativeTime } from '@/lib/format-relative-time'
import WithdrawableAlert from '@/components/dashboard/withdrawable-alert'
import ConsentModal from '@/components/dashboard/consent-modal'
import StoriesBar from '@/components/dashboard/stories-bar'
import {
  Search, Wallet, PlusCircle, List, ArrowLeft, Loader2,
  CheckCircle2, ExternalLink, ArrowUpRight, ArrowDownLeft,
  Banknote, Building2, Send, Megaphone, X
} from 'lucide-react'
import { Suspense } from 'react'
import WalletPreferences from '@/components/dashboard/wallet-preferences'
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
import { readTimedCache, writeTimedCache } from '@/lib/client-cache'

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
    email?: string
  }
}

function DashboardContent() {
  const DASHBOARD_CACHE_TTL_MS = 60 * 1000
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
  const [depositStep, setDepositStep] = useState<'amount' | 'payment' | 'confirming'>('amount')
  const [depositEntity, setDepositEntity] = useState('')
  const [depositReference, setDepositReference] = useState('')
  const [depositRefPhone, setDepositRefPhone] = useState('')
  const [depositTxnId, setDepositTxnId] = useState('')
  const [depositSubmitting, setDepositSubmitting] = useState(false)

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
    const { data } = await supabase.from('profiles').select('id, display_name, avatar_url, balance, is_verified, is_free_plan, preferred_currency, withdrawal_country, bank_account_name, bank_name, bank_account_number, bank_branch, bank_pix').eq('id', userId).single()
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
        .select('*, profiles(display_name, avatar_url, is_verified, email)')
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
        const cacheKey = `xoxo:dashboard:data:${currentUser.id}:${mode || 'feed'}:${view || 'default'}`
        const cached = readTimedCache<{
          posts: Post[]
          transactions: any[]
          announcements: any[]
          profile: any
          balance: number
        }>(cacheKey, DASHBOARD_CACHE_TTL_MS)

        if (cached) {
          setPosts(cached.posts || [])
          setTransactions(cached.transactions || [])
          setDashboardAnnouncements(cached.announcements || [])
          setUserProfile(cached.profile || null)
          setBalance(Number(cached.balance || 0))
          setLoading(false)
        }

        // Fetch User Profile
        const { data: profile, error: profileError } = await supabase.from('profiles').select('id, display_name, avatar_url, balance, is_verified, is_free_plan, preferred_currency, withdrawal_country, bank_account_name, bank_name, bank_account_number, bank_branch, bank_pix').eq('id', currentUser.id).single()
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

        let postsForCache: Post[] = cached?.posts || []
        let transactionsForCache: any[] = cached?.transactions || []

        if (mode === 'wallet') {
          // Fetch Transactions
          const { data: transData } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
          if (transData) {
            setTransactions(transData)
            transactionsForCache = transData
          }
        } else {
          // Fetch posts with pagination
          const { data: postsData, error: postsError } = await supabase
            .from('posts')
            .select('*, profiles(display_name, avatar_url, is_verified, email)')
            .order('created_at', { ascending: false })
            .range(0, POSTS_PER_PAGE - 1)

          if (postsError) throw postsError
          setPosts(postsData || [])
          setHasMore((postsData?.length || 0) >= POSTS_PER_PAGE)
          setPage(1)
          postsForCache = postsData || []
        }

        writeTimedCache(cacheKey, {
          posts: postsForCache,
          transactions: transactionsForCache,
          announcements: annData || [],
          profile: profile || null,
          balance: Number(profile?.balance || 0),
        })
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar conteúdo')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase, router, mode, view])

  // Prevent navigation during deposit payment step
  useEffect(() => {
    if (depositStep === 'payment') {
      const onBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
      }
      const onPopState = () => {
        if (!confirm('Tens um depósito pendente. Se saíres sem confirmar, o pedido será perdido. Deseja continuar?')) {
          window.history.pushState(null, '', window.location.href)
        }
      }
      window.addEventListener('beforeunload', onBeforeUnload)
      window.addEventListener('popstate', onPopState)
      window.history.pushState(null, '', window.location.href)
      return () => {
        window.removeEventListener('beforeunload', onBeforeUnload)
        window.removeEventListener('popstate', onPopState)
      }
    }
  }, [depositStep])

  const handleRequestDeposit = async () => {
    const minDep = minDepositForCurrency(preferredCurrency)
    if (!depositAmount || parseFloat(depositAmount) < minDep) {
      alert(`O valor mínimo de depósito é ${formatMoney(minDep, preferredCurrency)}`)
      return
    }
    setDepositLoading(true)
    try {
      const res = await fetch('/api/deposits/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(depositAmount) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDepositEntity(data.entity)
      setDepositReference(data.reference)
      setDepositRefPhone(data.phone)
      setDepositTxnId(data.transaction.id)
      setDepositStep('payment')
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setDepositLoading(false)
    }
  }

  const handleConfirmDeposit = async () => {
    if (!confirm('ATENÇÃO: Ao confirmar, declara que realizou o pagamento. Se confirmar sem efectuar o pagamento, a sua conta poderá ser banida. Deseja continuar?')) return
    setDepositSubmitting(true)
    try {
      alert('Pedido de depósito enviado! O administrador irá aprovar o seu depósito em breve.')
      setDepositStep('amount')
      setDepositAmount('')
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setDepositSubmitting(false)
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

    const pendingWithdrawals = transactions.filter(t => t.type === 'withdraw' && t.status === 'pending').reduce((s, t) => s + Number(t.amount), 0)

    if (pendingWithdrawals > 0) {
      return alert('Já tens um pedido de levantamento pendente. Aguarda até ser processado antes de solicitar outro.')
    }

    if (amount > balance - pendingWithdrawals) {
      return alert('Saldo insuficiente para levantamento.')
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

      const { data: newTxn } = await supabase.from('transactions').insert({
        user_id: user.id,
        amount: amount,
        type: 'withdraw',
        description,
        status: 'pending',
      }).select().single()

      if (newTxn) {
        setTransactions(prev => [newTxn, ...(prev || [])])
      }

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
    <div className={`min-h-screen transition-colors duration-300 bg-background`}>
      <Header user={user} />
      
      <div className={`max-w-[1128px] mx-auto flex justify-center gap-6 pt-6 px-4 ${mode === 'wallet' ? 'flex-col lg:flex-row' : ''}`}>
        <div className="hidden lg:block w-[225px] flex-shrink-0">
          <Sidebar />
        </div>

        <div className="flex-1 max-w-[800px] w-full min-h-[80vh]">
          {mode === 'wallet' ? (
            <div className="space-y-4">
              {view === 'balance' || !view ? (
                <div className={`overflow-hidden rounded-2xl border shadow-sm transition-colors duration-300 bg-card border-border`}>
                  <div className="bg-[linear-gradient(135deg,#111827_0%,#e31e24_65%,#7f1d1d_100%)] p-6 text-white sm:p-7">
                    <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/80">
                      <Wallet size={18} /> Saldo
                    </h2>
                    <p className="text-3xl font-black tracking-tight sm:text-4xl">{formatMoney(balance, preferredCurrency)}</p>
                    {(() => {
                      const pending = (transactions || []).filter(t => t.type === 'withdraw' && t.status === 'pending').reduce((s, t) => s + Number(t.amount), 0)
                      if (pending > 0) {
                        return (
                          <p className="mt-2 text-xs font-medium text-white/70">
                            {formatMoney(pending, preferredCurrency)} em levantamento
                          </p>
                        )
                      }
                      return null
                    })()}
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
                <div className="overflow-hidden rounded-2xl border shadow-sm border-border bg-card">
                  <div className="border-b p-4 border-border bg-muted/50">
                    <h2 className="flex items-center gap-2 text-lg font-bold">
                      <PlusCircle className="text-accent" /> Carregar Carteira
                    </h2>
                  </div>

                  <div className="p-5 sm:p-6">
                    <div className="mx-auto max-w-sm space-y-4">
                      {searchParams.get('required') === '1' && (
                        <div className="rounded-xl border p-3 text-center text-xs font-medium bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-900/70">
                          Atingiste o limite gratuito (3 publicações, 3 mensagens, 3 comentários). Realiza um depósito para continuar.
                        </div>
                      )}
                      {depositSuccess && (
                        <div className="flex items-center justify-center gap-2 rounded-xl border p-3 text-center text-xs font-medium bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-900/70">
                          <CheckCircle2 size={18} /> Pagamento recebido! O saldo será atualizado em breve.
                        </div>
                      )}

                      {depositStep === 'amount' && (
                        <>
                          <div className="text-center">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Pagamento por Referência</p>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-lg">
                                {currencyOpt.symbol}
                              </span>
                              <input
                                type="number"
                                min={minDeposit}
                                placeholder={`Mín. ${minDeposit}`}
                                className="w-full rounded-xl border py-3 pl-14 pr-5 text-center text-xl font-black outline-none transition-colors focus:border-accent border-border bg-muted text-foreground"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {depositPresets.map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setDepositAmount(val)}
                                className="rounded-lg border py-2 text-xs font-bold transition-colors hover:border-accent hover:text-accent border-border bg-muted text-muted-foreground"
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={handleRequestDeposit}
                            disabled={depositLoading || !depositAmount}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50"
                          >
                            {depositLoading ? <Loader2 className="animate-spin" size={20} /> : <ExternalLink size={18} />}
                            Solicitar Depósito
                          </button>
                        </>
                      )}

                      {depositStep === 'payment' && (
                        <>
                          <div className="flex items-center gap-4 rounded-xl border-2 border-dashed border-green-400 bg-green-50 dark:bg-green-900/10 p-5">
                            <img src="/express.png" alt="Multicaixa Express" className="w-16 h-16 object-contain flex-shrink-0" />
                            <div>
                              <p className="text-sm font-bold text-green-700 dark:text-green-300">Pagamento por Referência</p>
                              <p className="text-xs text-green-600 dark:text-green-400">Multicaixa Express</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between rounded-xl border border-border bg-muted p-3">
                              <div>
                                <p className="text-[10px] text-muted-foreground font-medium">Entidade</p>
                                <p className="text-sm font-bold text-foreground">00930 · Unitel Money</p>
                              </div>
                              <button
                                onClick={() => { navigator.clipboard.writeText('00930'); alert('Entidade copiada!') }}
                                className="text-xs font-bold text-accent hover:underline px-2 py-1"
                              >
                                Copiar
                              </button>
                            </div>

                            <div className="flex items-center justify-between rounded-xl border border-border bg-muted p-3">
                              <div>
                                <p className="text-[10px] text-muted-foreground font-medium">Referência (Telefone)</p>
                                <p className="text-sm font-bold text-foreground tracking-widest">{depositReference}</p>
                              </div>
                              <button
                                onClick={() => { navigator.clipboard.writeText(depositReference); alert('Referência copiada!') }}
                                className="text-xs font-bold text-accent hover:underline px-2 py-1"
                              >
                                Copiar
                              </button>
                            </div>

                            <div className="flex items-center justify-between rounded-xl border border-border bg-muted p-3">
                              <div>
                                <p className="text-[10px] text-muted-foreground font-medium">Valor</p>
                                <p className="text-sm font-bold text-green-700 dark:text-green-400">{formatMoney(Number(depositAmount), preferredCurrency)}</p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-3 text-[11px] text-blue-800 dark:text-blue-200 leading-relaxed">
                            <p className="font-bold mb-1 text-xs">Instruções:</p>
                            <ol className="list-decimal list-inside space-y-0.5">
                              <li>Abra o <strong>Multicaixa Express</strong></li>
                              <li>Clique em <strong>Pagamentos</strong> → <strong>Pagamentos por Referência</strong></li>
                              <li>Insira a <strong>Entidade</strong> 00930 · Unitel Money</li>
                              <li>Insira a <strong>Referência</strong> (seu telefone) {depositReference}</li>
                              <li>Insira o <strong>Valor</strong> {formatMoney(Number(depositAmount), preferredCurrency)}</li>
                              <li>Confirme o pagamento</li>
                            </ol>
                          </div>

                          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3">
                            <p className="text-[11px] font-bold text-red-700 dark:text-red-300 mb-0.5">⚠️ Aviso</p>
                            <p className="text-[10px] text-red-600 dark:text-red-400 leading-relaxed">
                              Pague primeiro, depois confirme. Confirmar sem pagar pode resultar em <strong>banimento permanente</strong>.
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                if (confirm('Tens um depósito pendente. Se voltares sem confirmar, o pedido será perdido. Deseja continuar?')) {
                                  setDepositStep('amount')
                                }
                              }}
                              className="flex-1 rounded-lg border py-2 text-xs font-semibold border-border bg-muted text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                              Voltar
                            </button>
                            <button
                              onClick={handleConfirmDeposit}
                              disabled={depositSubmitting}
                              className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                              {depositSubmitting ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                              Já Paguei, Confirmar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : view === 'withdraw' ? (
                <div className="overflow-hidden rounded-2xl border shadow-sm border-border bg-card">
                  <div className="border-b p-4 border-border bg-orange-50/50 dark:bg-orange-950/20">
                    <h2 className="flex items-center gap-2 text-lg font-bold">
                      <Banknote className="text-orange-600" /> Levantamento de Dinheiro
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Saques para Angola, Brasil e Moçambique ({preferredCurrency}). O valor será
                      creditado na conta bancária configurada em Moeda e Banco.
                    </p>
                  </div>
                  <div className="p-5 sm:p-6">
                    <div className="mx-auto max-w-sm space-y-4">

                      {!bankComplete ? (
                        <div className="rounded-xl border p-4 text-sm bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-900/70">
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
                        <div className="space-y-1 rounded-xl border p-4 border-border bg-card">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Building2 size={14} /> Conta de recebimento
                          </p>
                          {formatBankSummary(withdrawalCountry, bankDetails).map((line) => (
                            <p key={line} className="text-sm text-foreground">{line}</p>
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
                            className="w-full rounded-xl border py-3 pl-14 pr-4 font-bold outline-none transition-colors focus:border-accent border-border bg-muted text-foreground"
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
                          className="w-full rounded-xl border px-4 py-3 text-sm font-bold outline-none transition-colors focus:border-accent border-border bg-muted text-foreground"
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
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 font-bold text-white shadow-lg shadow-orange-600/20 disabled:opacity-40"
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
                <div className="overflow-hidden rounded-2xl border shadow-sm border-border bg-card">
                  <div className="border-b p-4 border-border bg-muted/50">
                    <h2 className="flex items-center gap-2 text-lg font-bold">
                      <List className="text-accent" /> Histórico de Transações
                    </h2>
                  </div>
                  <div className="divide-y divide-border">
                    {transactions.length > 0 ? (
                      transactions.map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-accent hover:text-accent-foreground">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className={`p-2 rounded-full ${
                              t.type === 'deposit' || t.type === 'earnings' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                            }`}>
                              {t.type === 'deposit' ? <PlusCircle size={18} /> : t.type === 'earnings' ? <ArrowDownLeft size={18} /> : t.type === 'withdraw' ? <Banknote size={18} /> : <ArrowUpRight size={18} />}
                            </div>
                            <div className="min-w-0">
                              <p className="line-clamp-1 text-sm font-bold text-foreground">{t.description}</p>
                              <p className="text-[10px] text-gray-400 uppercase font-medium">{formatRelativeTime(t.created_at)} • {t.type}</p>
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
                      <div className="p-10 text-center text-sm italic text-gray-400">Ainda não existem transações registadas.</div>
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
                  <div key={a.id} className="rounded-xl p-5 mb-4 shadow-sm relative flex gap-4 animate-in fade-in duration-300 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                    <div className="p-3 rounded-xl w-12 h-12 flex items-center justify-center flex-shrink-0 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300">
                       <Megaphone size={22} />
                    </div>
                    <div className="flex-1 pr-6">
                      <h4 className="font-extrabold text-base mb-1 text-blue-900 dark:text-blue-200">{a.title}</h4>
                      <p className="text-xs leading-relaxed whitespace-pre-wrap text-blue-800 dark:text-blue-300">{a.content}</p>
                      {a.image_url && (
                        <img src={a.image_url} alt="anuncio" className="max-h-48 rounded-xl object-cover mt-3 border border-blue-100" />
                      )}
                    </div>
                    <button
                      onClick={() => setDismissedAnns([...dismissedAnns, a.id])}
                      className="absolute top-4 right-4 transition-colors text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}

              {/* Withdrawable Alert */}
              <WithdrawableAlert />

              {/* Stories */}
              <div className="-mx-4 w-[calc(100%+2rem)] sm:mx-0 sm:w-full">
                <StoriesBar currentUserId={user?.id || null} />
              </div>

              {/* Feed Logic Same as Before */}
              <div className="-mx-4 mb-4 w-[calc(100%+2rem)] rounded-none border p-4 shadow-sm transition-colors duration-300 sm:mx-0 sm:w-full sm:rounded-md border-border bg-card">
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
                    className="flex-1 text-left transition-colors rounded-full px-5 py-3 text-sm font-medium border bg-muted text-foreground hover:bg-accent hover:text-accent-foreground border-border"
                  >
                    O que vais publicar hoje, {userProfile?.display_name || user?.email?.split('@')[0]}?
                  </button>
                </div>
              </div>

              <CreatePostModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} user={user} />

              <div className="-mx-4 mb-4 w-[calc(100%+2rem)] xl:hidden">
                <SuggestedCreators variant="mobile" />
              </div>

              {loading ? (
                <div className="flex flex-col gap-4 w-full">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-[400px] bg-gray-200 rounded-md animate-pulse border border-border" />)}
                </div>
              ) : (
                <div className="flex flex-col gap-4 w-full overflow-visible">
                  {posts.map((post) => {
                    const isAdminCreator = post.profiles?.email && (
                      post.profiles.email.toLowerCase() === 'admin.xoxo@gmail.com' ||
                      post.profiles.email.toLowerCase() === 'superadmin.xoxo@gmail.com'
                    )
                    return (
                      <PostCard
                        key={post.id}
                        {...post}
                        creator_name={post.profiles?.display_name || 'Usuário'}
                        creator_avatar={post.profiles?.avatar_url || undefined}
                        creator_verified={isAdminCreator ? true : (post.profiles?.is_verified || false)}
                        creator_id={post.user_id}
                        is_admin_post={isAdminCreator || false}
                      />
                    )
                  })}
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
                <div key={a.id} className="rounded-2xl shadow-md p-5 overflow-hidden flex flex-col justify-between hover:shadow-lg transition-shadow bg-card border-border">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 border-purple-100 dark:border-purple-800">
                      Publicidade / Anúncio
                    </span>
                    <h4 className="font-extrabold text-sm mt-3 mb-1 text-foreground">{a.title}</h4>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">{a.content}</p>
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
