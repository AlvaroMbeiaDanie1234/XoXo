'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'

export default function LoginForm() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<'true' | 'already' | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const verified = params.get('verified') as 'true' | 'already' | null
      if (verified) {
        setVerificationStatus(verified)
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        setError(authError.message || 'Erro ao fazer login')
        setLoading(false)
        return
      }

      if (data?.user) {
        setSuccess(true)
        setError(null)
        
        // Redirecionar para o painel admin ou dashboard do utilizador
        setTimeout(() => {
          const lowerEmail = email.trim().toLowerCase()
          if (lowerEmail === 'admin.xoxo@gmail.com' || lowerEmail === 'superadmin.xoxo@gmail.com') {
            router.replace('/admin')
          } else {
            router.replace('/dashboard')
          }
        }, 500)
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao fazer login')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Alerta de E-mail Verificado com Sucesso */}
      {verificationStatus === 'true' && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm animate-in fade-in flex items-start gap-2.5">
          <span className="text-emerald-600 font-extrabold text-lg leading-none mt-0.5">✓</span>
          <div>
            <p className="font-bold text-emerald-900">E-mail ativado com sucesso! 💋</p>
            <p className="text-emerald-700 text-xs mt-0.5">A sua conta está agora 100% ativa. Faça login abaixo para aceder à plataforma.</p>
          </div>
        </div>
      )}

      {/* Alerta de Conta Já Verificada */}
      {verificationStatus === 'already' && (
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm animate-in fade-in flex items-start gap-2.5">
          <span className="text-blue-600 font-bold text-lg leading-none mt-0.5">ℹ</span>
          <div>
            <p className="font-bold text-blue-900">Conta já ativada</p>
            <p className="text-blue-700 text-xs mt-0.5">A sua conta já se encontrava ativada. Pode iniciar sessão normalmente.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-100 border border-red-400 text-red-700 text-sm animate-in fade-in">
          <p className="font-semibold mb-1">Erro ao fazer login:</p>
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg bg-green-100 border border-green-400 text-green-700 text-sm animate-in fade-in">
          <p className="font-semibold">Login realizado com sucesso!</p>
          <p>Redirecionando...</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition"
          placeholder={t('login.form.email')}
          required
          disabled={loading}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-foreground">
            Senha
          </label>
          <button
            type="button"
            onClick={() => router.push('/auth/reset-password')}
            className="text-sm text-primary hover:underline"
          >
            Esqueceu a senha?
          </button>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition"
          placeholder={t('login.form.password')}
          required
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        disabled={loading || success}
        className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block animate-spin">⟳</span>
            {t('login.form.loading')}
          </span>
        ) : success ? (
          'Login realizado!'
        ) : (
          t('login.form.submit')
        )}
      </button>
    </form>
  )
}
