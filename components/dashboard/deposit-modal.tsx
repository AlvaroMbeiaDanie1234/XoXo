'use client'

import { useState } from 'react'
import { X, CreditCard, Loader2, ArrowRight, Wallet, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface DepositModalProps {
  isOpen: boolean
  onClose: () => void
  user: any
  onSuccess: () => void
}

export default function DepositModal({ isOpen, onClose, user, onSuccess }: DepositModalProps) {
  const [amount, setAmount] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !amount || parseFloat(amount) <= 0) return
    
    setLoading(true)
    try {
      // Simulate LinkPaga Redirect
      const depositAmount = parseFloat(amount)
      alert(`Redirecionando para LinkPaga para depósito de AOA ${depositAmount.toLocaleString()}...`)
      
      // Simulate successful payment callback
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
        onClose()
      }, 2000)
    } catch (err: any) {
      alert('Erro ao depositar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden">
        {/* Header */}
        <div className="bg-accent p-6 text-white text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors">
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
          ) : (
            <form onSubmit={handleDeposit} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Valor a Depositar (AOA)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">AOA</span>
                  <input
                    type="number"
                    placeholder="Ex: 5000"
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 pl-14 pr-4 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all text-xl font-bold"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {['1000', '2000', '5000'].map(val => (
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
