'use client'

import { useState } from 'react'
import { X, CreditCard, Loader2, ArrowRight, Wallet, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !amount || parseFloat(amount) < 100) {
      alert('O valor mínimo de depósito é AOA 100')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/payments/flutterwave/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(amount) }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao iniciar pagamento')
      }

      window.location.href = data.link
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao depositar'
      alert(message)
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
              : 'Adiciona saldo via Flutterwave (ambiente seguro)'}
          </p>
        </div>

        <div className="p-8">
          <form onSubmit={handleDeposit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Valor a Depositar (AOA)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">AOA</span>
                <input
                  type="number"
                  placeholder="Ex: 5000"
                  required
                  min={100}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 pl-14 pr-4 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all text-xl font-bold"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {['1000', '2000', '5000'].map((val) => (
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

            <button
              type="submit"
              disabled={loading || !amount}
              className="w-full bg-accent hover:bg-accent/90 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={24} className="animate-spin" /> : <CreditCard size={20} />}
              <span>Pagar com Flutterwave</span>
              <ArrowRight size={18} />
            </button>

            {!required && (
              <button
                type="button"
                onClick={() => router.push('/dashboard?mode=wallet&view=deposit')}
                className="w-full text-xs text-gray-500 hover:text-accent font-medium"
              >
                Ver opções na carteira
              </button>
            )}

            <p className="text-[10px] text-center text-gray-400 px-4">
              Serás redirecionado para o checkout seguro da Flutterwave. O saldo é creditado automaticamente após confirmação.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
