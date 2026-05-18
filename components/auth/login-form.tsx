'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

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
        
        // Redirecionar para o dashboard
        setTimeout(() => {
          router.replace('/dashboard')
        }, 500)
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao fazer login')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          placeholder="seu@email.com"
          required
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Senha
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition"
          placeholder="••••••••"
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
            Entrando...
          </span>
        ) : success ? (
          'Login realizado!'
        ) : (
          'Entrar'
        )}
      </button>
    </form>
  )
}
