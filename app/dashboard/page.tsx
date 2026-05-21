'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Sidebar from '@/components/dashboard/sidebar'
import PostCard from '@/components/dashboard/post-card'
import Header from '@/components/dashboard/header'
import CreatePostModal from '@/components/dashboard/create-post-modal'
import SuggestedCreators from '@/components/dashboard/suggested-creators'
import { 
  Search, Wallet, PlusCircle, List, ArrowLeft, Loader2, 
  CheckCircle2, ExternalLink, ArrowUpRight, ArrowDownLeft,
  Banknote, Building2, Send, Megaphone, X, CreditCard, ArrowRight
} from 'lucide-react'
import { Suspense } from 'react'

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
  
  // Wallet states
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [bankDetails, setBankDetails] = useState('')
  const [showIframe, setShowIframe] = useState(false)
  const [paymentUrl, setPaymentUrl] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [depositMethod, setDepositMethod] = useState<'select' | 'linkpaga' | 'flutterwave'>('select')
  const [flutterwavePublicKey, setFlutterwavePublicKey] = useState('')
  const [flutterwaveScriptLoaded, setFlutterwaveScriptLoaded] = useState(false)
  const [flutterwaveSuccess, setFlutterwaveSuccess] = useState(false)

  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')
  const view = searchParams.get('view')

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

        // Fetch Settings
        const { data: settings } = await supabase.from('system_settings').select('*').eq('key', 'linkpaga_slug').single()
        if (settings) {
          const slug = settings.value
          setPaymentUrl(`https://linkpaga.com/p/${slug}`)
        }

        // Fetch Flutterwave public key
        const { data: fwSettings } = await supabase.from('system_settings').select('*').eq('key', 'FLUTTERWAVE_PUBLIC_KEY').single()
        if (fwSettings?.value) {
          setFlutterwavePublicKey(fwSettings.value)
        }

        // Fetch active announcements
        const { data: annData } = await supabase
          .from('system_announcements')
          .select('*')
          .or(`target_user_id.is.null,target_user_id.eq.${currentUser.id}`)
          .order('created_at', { ascending: false })
        if (annData) setDashboardAnnouncements(annData)

        if (mode === 'wallet') {
          // Fetch Transactions
          const { data: transData } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
          if (transData) setTransactions(transData)
        } else {
          // Fetch posts
          const { data: postsData, error: postsError } = await supabase
            .from('posts')
            .select('*, profiles(display_name, avatar_url)')
            .order('created_at', { ascending: false })

          if (postsError) throw postsError
          setPosts(postsData || [])
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar conteúdo')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase, router, mode, view])

  // Load Flutterwave inline script
  useEffect(() => {
    if (typeof window !== 'undefined' && !document.getElementById('flutterwave-script')) {
      const script = document.createElement('script')
      script.id = 'flutterwave-script'
      script.src = 'https://checkout.flutterwave.com/v3.js'
      script.async = true
      script.onload = () => setFlutterwaveScriptLoaded(true)
      document.head.appendChild(script)
    } else if (document.getElementById('flutterwave-script')) {
      setFlutterwaveScriptLoaded(true)
    }
  }, [])

  const handleStartDeposit = () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return
    setShowIframe(true)
  }

  const handleFlutterwaveDeposit = () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0 || !user) return
    if (!flutterwavePublicKey) {
      alert('Flutterwave não está configurado. Contacte o administrador.')
      return
    }

    const FlutterwaveCheckout = (window as any).FlutterwaveCheckout
    if (!FlutterwaveCheckout) {
      alert('Erro ao carregar o sistema de pagamento. Tente novamente.')
      return
    }

    const txRef = `XOXO-${user.id.substring(0, 8)}-${Date.now()}`

    FlutterwaveCheckout({
      public_key: flutterwavePublicKey,
      tx_ref: txRef,
      amount: parseFloat(depositAmount),
      currency: 'USD',
      payment_options: 'card',
      customer: {
        email: user.email,
        name: userProfile?.display_name || user.email?.split('@')[0] || 'Cliente XoXo',
      },
      customizations: {
        title: 'XoXo - Recarregar Carteira',
        description: `Depósito de ${parseFloat(depositAmount).toLocaleString()} na carteira XoXo`,
        logo: '/icon-light-32x32.png',
      },
      callback: async (response: any) => {
        if (response.status === 'successful') {
          setIsProcessing(true)
          try {
            const verifyRes = await fetch('/api/flutterwave/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                transaction_id: response.transaction_id,
                tx_ref: response.tx_ref
              })
            })

            const verifyData = await verifyRes.json()

            if (verifyRes.ok && verifyData.status === 'success') {
              setFlutterwaveSuccess(true)
              // Refresh balance
              const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
              if (profile) setBalance(profile.balance || 0)
              window.dispatchEvent(new Event('balanceUpdated'))
              setTimeout(() => {
                setFlutterwaveSuccess(false)
                setDepositAmount('')
                setDepositMethod('select')
                router.push('/dashboard?mode=wallet&view=transactions')
              }, 2000)
            } else {
              alert('Erro na verificação do pagamento. Contacte o suporte.')
            }
          } catch (err: any) {
            alert('Erro ao verificar pagamento: ' + err.message)
          } finally {
            setIsProcessing(false)
          }
        }
      },
      onclose: () => {
        // User closed payment modal
      }
    })
  }

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0 || !bankDetails) return
    const amount = parseFloat(withdrawAmount)
    
    // Calculate withdrawable balance
    const totalDeposits = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0);
    const totalPurchases = transactions.filter(t => t.type === 'purchase').reduce((s, t) => s + Number(t.amount), 0);
    const unspentDeposits = Math.max(0, totalDeposits - totalPurchases);
    const withdrawable = Math.max(0, balance - unspentDeposits);

    if (amount > withdrawable) return alert('Saldo insuficiente para levantamento! Apenas ganhos podem ser levantados.')

    setIsProcessing(true)
    try {
      await supabase.from('transactions').insert({
        user_id: user.id,
        amount: amount,
        type: 'withdraw',
        description: `Levantamento para: ${bankDetails}`,
        status: 'pending' // Note: trigger won't deduct until status is completed, or should we deduct immediately? Let's keep it pending, the admin handles it.
      })
      
      // Fetch the updated balance just in case
      const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
      if (profile) setBalance(profile.balance || 0)

      // Send SMS notification (non-blocking)
      fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          body: `O seu pedido de levantamento de AOA ${amount.toLocaleString()} foi submetido com sucesso e está pendente de aprovação. Receberá outro SMS quando for processado.`
        })
      }).catch(console.warn)

      setWithdrawAmount('')
      setBankDetails('')
      alert('Pedido de levantamento enviado com sucesso! Será processado em breve.')
      router.push('/dashboard?mode=wallet&view=transactions')
    } catch (err: any) {
      alert('Erro: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      
      <div className={`max-w-[1128px] mx-auto flex justify-center gap-6 pt-6 px-4 ${mode === 'wallet' ? 'flex-col lg:flex-row' : ''}`}>
        <div className="hidden lg:block w-[225px] flex-shrink-0">
          <Sidebar />
        </div>

        <div className="flex-1 max-w-[800px] w-full min-h-[80vh]">
          {mode === 'wallet' ? (
            <div className="space-y-6">
              {view === 'balance' || !view ? (
                <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
                  <div className="bg-accent p-10 text-white">
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-3">
                      <Wallet /> Saldo Disponível (Para Compras)
                    </h2>
                    <p className="text-5xl font-black tracking-tighter">AOA {balance.toLocaleString()}</p>
                  </div>
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-green-50 rounded-2xl border border-green-100">
                      <div className="flex items-center gap-3 mb-2 text-green-600">
                        <ArrowDownLeft size={20} />
                        <p className="text-xs font-bold uppercase tracking-widest">Ganhos (A Levantar)</p>
                      </div>
                      <p className="text-2xl font-black text-green-700">
                        AOA {
                          (() => {
                            const totalDeposits = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0);
                            const totalPurchases = transactions.filter(t => t.type === 'purchase').reduce((s, t) => s + Number(t.amount), 0);
                            const unspentDeposits = Math.max(0, totalDeposits - totalPurchases);
                            const withdrawable = Math.max(0, balance - unspentDeposits);
                            return withdrawable.toLocaleString();
                          })()
                        }
                      </p>
                    </div>
                    <div className="p-6 bg-red-50 rounded-2xl border border-red-100">
                      <div className="flex items-center gap-3 mb-2 text-red-600">
                        <ArrowUpRight size={20} />
                        <p className="text-xs font-bold uppercase tracking-widest">Despesas</p>
                      </div>
                      <p className="text-2xl font-black text-red-700">AOA {transactions.filter(t => t.type === 'purchase').reduce((s, t) => s + Number(t.amount), 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ) : view === 'deposit' ? (
                <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-border flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <PlusCircle className="text-accent" /> Carregar Carteira
                    </h2>
                    {(showIframe || depositMethod !== 'select') && (
                      <button onClick={() => { setShowIframe(false); setDepositMethod('select') }} className="text-sm text-red-500 font-bold">Cancelar</button>
                    )}
                  </div>
                  
                  <div className="p-8">
                    {flutterwaveSuccess ? (
                      <div className="text-center py-8 animate-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle2 size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Depósito Concluído!</h3>
                        <p className="text-gray-500 text-sm mt-2">O seu novo saldo já está disponível.</p>
                      </div>
                    ) : depositMethod === 'select' ? (
                      <div className="max-w-md mx-auto space-y-6">
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">Valor do Depósito</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-lg">USD</span>
                            <input
                              type="number"
                              placeholder="Ex: 50"
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 pl-16 pr-6 outline-none focus:border-accent text-2xl font-black"
                              value={depositAmount}
                              onChange={(e) => setDepositAmount(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {['10', '25', '50'].map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setDepositAmount(val)}
                              className="py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:border-accent hover:text-accent transition-colors"
                            >
                              +${val}
                            </button>
                          ))}
                        </div>

                        <div className="space-y-3 pt-2">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Escolha o Método de Pagamento</p>

                          {/* Flutterwave - Card payments */}
                          <button
                            onClick={() => {
                              if (depositAmount && parseFloat(depositAmount) > 0) {
                                setDepositMethod('flutterwave')
                              } else {
                                alert('Insira um valor válido primeiro.')
                              }
                            }}
                            className="w-full border border-gray-200 hover:border-accent rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-md group"
                          >
                            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                              <CreditCard size={24} className="text-orange-600" />
                            </div>
                            <div className="text-left flex-1">
                              <p className="font-bold text-gray-900 text-sm">Cartão de Crédito/Débito</p>
                              <p className="text-[11px] text-gray-400">Visa, Mastercard e outros via Flutterwave</p>
                            </div>
                            <ArrowRight size={16} className="text-gray-300 group-hover:text-accent transition-colors" />
                          </button>

                          {/* LinkPaga */}
                          <button
                            onClick={() => {
                              if (depositAmount && parseFloat(depositAmount) > 0) {
                                setDepositMethod('linkpaga')
                              } else {
                                alert('Insira um valor válido primeiro.')
                              }
                            }}
                            className="w-full border border-gray-200 hover:border-accent rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-md group"
                          >
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                              <Wallet size={24} className="text-blue-600" />
                            </div>
                            <div className="text-left flex-1">
                              <p className="font-bold text-gray-900 text-sm">LinkPaga</p>
                              <p className="text-[11px] text-gray-400">Pagamento via plataforma LinkPaga</p>
                            </div>
                            <ArrowRight size={16} className="text-gray-300 group-hover:text-accent transition-colors" />
                          </button>
                        </div>
                      </div>
                    ) : depositMethod === 'flutterwave' ? (
                      <div className="max-w-md mx-auto space-y-6">
                        <button onClick={() => setDepositMethod('select')} className="text-sm text-accent font-bold flex items-center gap-1 hover:underline">
                          ← Voltar
                        </button>

                        <div className="text-center">
                          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <CreditCard size={32} className="text-orange-600" />
                          </div>
                          <h3 className="text-xl font-bold text-gray-900">Pagamento com Cartão</h3>
                          <p className="text-gray-400 text-sm">Visa, Mastercard e outros</p>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-center">
                          <span className="text-sm text-gray-500">Valor</span>
                          <span className="text-2xl font-black text-gray-900">USD {parseFloat(depositAmount).toLocaleString()}</span>
                        </div>

                        <button
                          onClick={handleFlutterwaveDeposit}
                          disabled={isProcessing || !flutterwaveScriptLoaded}
                          className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-xl font-bold text-base shadow-lg shadow-orange-200 flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                        >
                          {isProcessing ? <Loader2 size={24} className="animate-spin" /> : <CreditCard size={20} />}
                          Pagar com Cartão
                        </button>

                        <div className="flex items-center justify-center gap-3 opacity-60">
                          <img src="https://img.icons8.com/color/32/visa.png" alt="Visa" className="h-6" />
                          <img src="https://img.icons8.com/color/32/mastercard-logo.png" alt="Mastercard" className="h-6" />
                          <img src="https://img.icons8.com/color/32/amex.png" alt="Amex" className="h-6" />
                        </div>

                        <p className="text-[10px] text-center text-gray-400 px-4">
                          Pagamento seguro processado pela Flutterwave. Os seus dados de cartão são encriptados.
                        </p>
                      </div>
                    ) : depositMethod === 'linkpaga' && !showIframe ? (
                      <div className="max-w-md mx-auto space-y-6 text-center">
                        <button onClick={() => setDepositMethod('select')} className="text-sm text-accent font-bold flex items-center gap-1 hover:underline">
                          ← Voltar
                        </button>
                        <img src="https://linkpaga.com/assets/img/logo.png" className="h-10 mx-auto mb-6 opacity-80" alt="linkpaga" />
                        <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-center">
                          <span className="text-sm text-gray-500">Valor</span>
                          <span className="text-2xl font-black text-gray-900">AOA {parseFloat(depositAmount).toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col gap-3">
                          <button 
                            onClick={handleStartDeposit}
                            disabled={!depositAmount}
                            className="w-full bg-accent text-white py-4 rounded-xl font-bold text-base shadow-lg active:scale-95 transition-all"
                          >
                            Pagar via Iframe (Nesta Página)
                          </button>
                          <a 
                            href={paymentUrl}
                            target="_blank"
                            className="w-full bg-gray-100 text-gray-700 py-4 rounded-xl font-bold text-base hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                          >
                            <ExternalLink size={18} /> Abrir em Nova Aba
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between mb-2">
                           <p className="text-xs text-gray-500 italic">Dica: Insira o email da sua conta na página de pagamento para garantir o crédito automático. Se a página não carregar abaixo, clique em &quot;Abrir em Nova Aba&quot;.</p>
                           <a href={paymentUrl} target="_blank" className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
                             <ExternalLink size={14} /> Abrir em Nova Aba
                           </a>
                        </div>
                        <div className="w-full aspect-[4/6] bg-white rounded-2xl border border-border relative overflow-hidden shadow-2xl">
                          <iframe src={paymentUrl} className="w-full h-full border-none" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : view === 'withdraw' ? (
                <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-border bg-orange-50/30">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Banknote className="text-orange-600" /> Levantamento de Dinheiro
                    </h2>
                  </div>
                  <div className="p-8">
                    <div className="max-w-md mx-auto space-y-6">
                      <div className="bg-gray-50 p-4 rounded-xl border border-border flex justify-between items-center">
                        <span className="text-sm text-gray-500">Saldo Disponível</span>
                        <span className="font-bold text-gray-900">AOA {balance.toLocaleString()}</span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Valor a Levantar</label>
                        <input
                          type="number"
                          placeholder="0"
                          className="w-full bg-gray-50 border border-border rounded-xl py-3 px-4 outline-none focus:border-accent font-bold"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">IBAN / Coordenadas Multicaixa Express</label>
                        <textarea
                          placeholder="Insira os dados da conta para recepção do valor..."
                          className="w-full bg-gray-50 border border-border rounded-xl py-3 px-4 outline-none focus:border-accent text-sm min-h-[100px]"
                          value={bankDetails}
                          onChange={(e) => setBankDetails(e.target.value)}
                        />
                      </div>

                      <button 
                        onClick={handleWithdraw}
                        disabled={isProcessing || !withdrawAmount || !bankDetails}
                        className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-orange-100 flex items-center justify-center gap-2"
                      >
                        {isProcessing ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                        Solicitar Levantamento
                      </button>
                      <p className="text-[10px] text-center text-gray-400">O processamento do levantamento pode levar até 24h úteis.</p>
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
                              {t.type === 'deposit' || t.type === 'earnings' ? '+' : '-'} AOA {t.amount.toLocaleString()}
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
                  <div key={a.id} className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-4 shadow-sm relative flex gap-4 animate-in fade-in duration-300">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-xl w-12 h-12 flex items-center justify-center flex-shrink-0">
                       <Megaphone size={22} />
                    </div>
                    <div className="flex-1 pr-6">
                      <h4 className="font-extrabold text-blue-900 text-base mb-1">{a.title}</h4>
                      <p className="text-xs text-blue-800 leading-relaxed whitespace-pre-wrap">{a.content}</p>
                      {a.image_url && (
                        <img src={a.image_url} alt="anuncio" className="max-h-48 rounded-xl object-cover mt-3 border border-blue-100" />
                      )}
                    </div>
                    <button 
                      onClick={() => setDismissedAnns([...dismissedAnns, a.id])}
                      className="absolute top-4 right-4 text-blue-400 hover:text-blue-600 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}

              {/* Feed Logic Same as Before */}
              <div className="bg-white border border-border rounded-md p-4 mb-4 shadow-sm w-full">
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
                    className="flex-1 text-left bg-[#f3f2ef] hover:bg-gray-200 transition-colors rounded-full px-5 py-3 text-sm text-gray-600 font-medium border border-border"
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
                <div className="flex flex-col gap-4 w-full">
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
                <div key={a.id} className="bg-white border border-border rounded-2xl shadow-md p-5 overflow-hidden flex flex-col justify-between hover:shadow-lg transition-shadow">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-50 text-purple-600 border border-purple-100">
                      Publicidade / Anúncio
                    </span>
                    <h4 className="font-extrabold text-gray-900 text-sm mt-3 mb-1">{a.title}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">{a.content}</p>
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
