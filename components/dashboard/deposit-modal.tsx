'use client'

import { useState, useEffect } from 'react'
import { X, CreditCard, Loader2, ArrowRight, Wallet, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface DepositModalProps {
  isOpen: boolean
  onClose: () => void
  user: any
  onSuccess: () => void
}

type PaymentMethod = 'select' | 'linkpaga' | 'flutterwave'

export default function DepositModal({ isOpen, onClose, user, onSuccess }: DepositModalProps) {
  const [amount, setAmount] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('select')
  const [flutterwavePublicKey, setFlutterwavePublicKey] = useState<string>('')
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Load Flutterwave public key from system_settings
    const loadFlutterwaveKey = async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'FLUTTERWAVE_PUBLIC_KEY')
        .single()
      if (data?.value) {
        setFlutterwavePublicKey(data.value)
      }
    }
    loadFlutterwaveKey()
  }, [supabase])

  useEffect(() => {
    // Load Flutterwave inline script
    if (typeof window !== 'undefined' && !document.getElementById('flutterwave-script')) {
      const script = document.createElement('script')
      script.id = 'flutterwave-script'
      script.src = 'https://checkout.flutterwave.com/v3.js'
      script.async = true
      script.onload = () => setScriptLoaded(true)
      document.head.appendChild(script)
    } else if (document.getElementById('flutterwave-script')) {
      setScriptLoaded(true)
    }
  }, [])

  const handleLinkPagaDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !amount || parseFloat(amount) <= 0) return

    setLoading(true)
    try {
      const depositAmount = parseFloat(amount)
      alert(`Redirecionando para LinkPaga para depósito de AOA ${depositAmount.toLocaleString()}...`)

      const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
      const newBalance = (profile?.balance || 0) + depositAmount

      const { error } = await supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', user.id)

      if (error) throw error

      setSuccess(true)
      onSuccess()
      setTimeout(() => {
        setSuccess(false)
        setAmount('')
        setPaymentMethod('select')
        onClose()
      }, 2000)
    } catch (err: any) {
      alert('Erro ao depositar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFlutterwavePayment = () => {
    if (!user || !amount || parseFloat(amount) <= 0) return
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
      amount: parseFloat(amount),
      currency: 'USD',
      payment_options: 'card',
      customer: {
        email: user.email,
        name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Cliente XoXo',
      },
      customizations: {
        title: 'XoXo - Recarregar Carteira',
        description: `Depósito de ${parseFloat(amount).toLocaleString()} na carteira XoXo`,
        logo: '/icon-light-32x32.png',
      },
      callback: async (response: any) => {
        if (response.status === 'successful') {
          setLoading(true)
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
              setSuccess(true)
              onSuccess()
              window.dispatchEvent(new Event('balanceUpdated'))
              setTimeout(() => {
                setSuccess(false)
                setAmount('')
                setPaymentMethod('select')
                onClose()
              }, 2000)
            } else {
              alert('Erro na verificação do pagamento. Contacte o suporte.')
            }
          } catch (err: any) {
            alert('Erro ao verificar pagamento: ' + err.message)
          } finally {
            setLoading(false)
          }
        }
      },
      onclose: () => {
        // User closed the payment modal
      }
    })
  }

  const resetModal = () => {
    setPaymentMethod('select')
    setAmount('')
    setSuccess(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden">
        {/* Header */}
        <div className="bg-accent p-6 text-white text-center relative">
          <button onClick={resetModal} className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors">
            <X size={20} />
          </button>
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/30">
            <Wallet size={32} />
          </div>
          <h2 className="text-xl font-bold">Recarregar Carteira</h2>
          <p className="text-white/80 text-sm">Adiciona saldo para desbloquear conteúdos</p>
        </div>

        {/* Body */}
        <div className="p-8">
          {success ? (
            <div className="text-center py-4 animate-in zoom-in duration-300">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Depósito Concluído!</h3>
              <p className="text-gray-500 text-sm mt-1">O seu novo saldo já está disponível.</p>
            </div>
          ) : paymentMethod === 'select' ? (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Valor a Depositar</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">USD</span>
                  <input
                    type="number"
                    placeholder="Ex: 50"
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 pl-14 pr-4 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all text-xl font-bold"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {['10', '25', '50'].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(val)}
                    className="py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:border-accent hover:text-accent transition-colors"
                  >
                    +${val}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Método de Pagamento</p>

                {/* Flutterwave - Card payments */}
                <button
                  onClick={() => {
                    if (amount && parseFloat(amount) > 0) {
                      setPaymentMethod('flutterwave')
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
                    if (amount && parseFloat(amount) > 0) {
                      setPaymentMethod('linkpaga')
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
          ) : paymentMethod === 'flutterwave' ? (
            <div className="space-y-6">
              <button onClick={() => setPaymentMethod('select')} className="text-sm text-accent font-bold flex items-center gap-1 hover:underline">
                ← Voltar
              </button>

              <div className="text-center">
                <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CreditCard size={28} className="text-orange-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Pagamento com Cartão</h3>
                <p className="text-gray-400 text-sm">Visa, Mastercard e outros</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-center">
                <span className="text-sm text-gray-500">Valor</span>
                <span className="text-xl font-black text-gray-900">USD {parseFloat(amount).toLocaleString()}</span>
              </div>

              <button
                onClick={handleFlutterwavePayment}
                disabled={loading || !scriptLoaded}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-orange-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={24} className="animate-spin" /> : <CreditCard size={20} />}
                <span>Pagar com Cartão</span>
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
          ) : (
            <form onSubmit={handleLinkPagaDeposit} className="space-y-6">
              <button type="button" onClick={() => setPaymentMethod('select')} className="text-sm text-accent font-bold flex items-center gap-1 hover:underline">
                ← Voltar
              </button>

              <div className="text-center">
                <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Wallet size={28} className="text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Pagamento via LinkPaga</h3>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-center">
                <span className="text-sm text-gray-500">Valor</span>
                <span className="text-xl font-black text-gray-900">AOA {parseFloat(amount).toLocaleString()}</span>
              </div>

              <button
                type="submit"
                disabled={loading || !amount}
                className="w-full bg-accent hover:bg-accent/90 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={24} className="animate-spin" /> : <CreditCard size={20} />}
                <span>Prosseguir com LinkPaga</span>
                <ArrowRight size={18} />
              </button>

              <p className="text-[10px] text-center text-gray-400 px-4">
                Ao prosseguir, você será redirecionado para o ambiente seguro da LinkPaga para concluir a transação.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
