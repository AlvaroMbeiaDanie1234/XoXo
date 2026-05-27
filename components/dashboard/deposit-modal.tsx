'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, ArrowRight, Wallet, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  getCurrencyOption,
  getDepositPresets,
  minDepositForCurrency,
  resolveProfileCurrency,
  type CurrencyCode,
} from '@/lib/wallet'

interface DepositModalProps {
  isOpen: boolean
  onClose: () => void
  user: any
  onSuccess: () => void
  required?: boolean
}

export default function DepositModal({ isOpen, onClose, user, onSuccess, required }: DepositModalProps) {
  const [amount, setAmount] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [currency, setCurrency] = useState<CurrencyCode>('AOA')
  const router = useRouter()
  const supabase = createClient()

  const currencyOpt = getCurrencyOption(currency)
  const minDeposit = minDepositForCurrency(currency)
  const presets = getDepositPresets(currency)

  useEffect(() => {
    if (!isOpen || !user?.id) return
    supabase
      .from('profiles')
      .select('preferred_currency, withdrawal_country')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setCurrency(resolveProfileCurrency(data))
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.id])

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !amount || parseFloat(amount) < minDeposit) {
      alert(`O valor mínimo de depósito é ${currencyOpt.symbol} ${minDeposit}`)
      return
    }

    setLoading(true)
    try {
      await fetch('/api/payments/flutterwave/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(amount), currency }),
      })
      alert('Canal de depósito em atualização. Aguarde a ativação da API para concluir o depósito.')
    } catch {
      alert('Canal de depósito em atualização. Aguarde a ativação da API para concluir o depósito.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden">
        <div className="bg-accent p-6 text-white text-center relative">
          {!required && (
            <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors">
              <X size={20} />
            </button>
          )}
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/30">
            <Wallet size={32} />
          </div>
          <h2 className="text-xl font-bold">
            {required ? 'Depósito Obrigatório' : 'Recarregar Carteira'}
          </h2>
          <p className="text-white/80 text-sm mt-1">
            {required
              ? 'Atingiste o limite gratuito. Deposita para continuar a usar a plataforma.'
              : 'Canal de depósito em atualização temporária'}
          </p>
        </div>

        <div className="p-8">
          <form onSubmit={handleDeposit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                Valor a Depositar ({currency})
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">{currencyOpt.symbol}</span>
                <input
                  type="number"
                  placeholder={`Mín. ${minDeposit}`}
                  required
                  min={minDeposit}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 pl-14 pr-4 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all text-xl font-bold"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => router.push('/dashboard?mode=wallet&view=payment-settings')}
                className="text-[10px] text-gray-400 mt-2 hover:text-accent font-medium"
              >
                Alterar país/moeda em Moeda e Banco →
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {presets.slice(0, 3).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val)}
                  className="py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:border-accent hover:text-accent transition-colors"
                >
                  +{val}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>Depósitos estão temporariamente indisponíveis enquanto atualizamos a API de pagamentos.</span>
            </div>

            <button
              type="submit"
              disabled={loading || !amount}
              className="w-full bg-accent hover:bg-accent/90 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={24} className="animate-spin" /> : <Wallet size={20} />}
              <span>Canal de depósito em atualização</span>
              <ArrowRight size={18} />
            </button>

            {!required && (
              <button
                type="button"
                onClick={() => router.push('/dashboard?mode=wallet&view=deposit')}
                className="w-full text-xs text-gray-500 hover:text-accent font-medium"
              >
                Abrir página completa de depósito
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
