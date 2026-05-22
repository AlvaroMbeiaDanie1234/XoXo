'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function SignupForm() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) setReferralCode(ref.trim().toUpperCase())
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMessage(null)
    setLoading(true)

    console.log('[v0] SignupForm: iniciando cadastro com:', email)

    try {
      // Validações
      if (!displayName.trim()) {
        const msg = 'Por favor, digite seu nome completo'
        console.log('[v0] SignupForm: validação falhou -', msg)
        setMessage({ type: 'error', text: msg })
        setLoading(false)
        return
      }

      if (!email.trim()) {
        const msg = 'Por favor, digite seu email'
        console.log('[v0] SignupForm: validação falhou -', msg)
        setMessage({ type: 'error', text: msg })
        setLoading(false)
        return
      }

      if (password.length < 6) {
        const msg = 'A senha deve ter no mínimo 6 caracteres'
        console.log('[v0] SignupForm: validação falhou -', msg)
        setMessage({ type: 'error', text: msg })
        setLoading(false)
        return
      }

      // Criar conta no Supabase usando nossa API de SMTP customizada
      console.log('[v0] SignupForm: enviando dados para a API personalizada de SMTP')
      const res = await fetch('/api/auth/sign-up', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
          ...(referralCode ? { referralCode } : {}),
        }),
      })

      const responseData = await res.json()
      console.log('[v0] SignupForm: resposta da API personalizada', responseData)

      if (!res.ok) {
        const errorMsg = responseData.error || 'Erro ao criar conta'
        console.error('[v0] SignupForm: erro ao criar conta', errorMsg)
        setMessage({
          type: 'error',
          text: errorMsg,
        })
        setLoading(false)
        return
      }

      console.log('[v0] SignupForm: conta criada e e-mail enviado com sucesso!')
      setMessage({
        type: 'success',
        text: 'Conta criada com sucesso! Enviámos um link de ativação para o seu e-mail. Por favor, verifique a sua caixa de entrada e spam para ativar a sua conta.',
      })
      
      // Limpar formulário
      setDisplayName('')
      setEmail('')
      setPassword('')

      // Redirecionar após 3.5 segundos para a página de sucesso
      setTimeout(() => {
        console.log('[v0] SignupForm: redirecionando para sign-up-success')
        router.replace('/auth/sign-up-success')
      }, 3500)
    } catch (err: any) {
      const errorMsg = `Erro inesperado: ${err?.message || 'Tente novamente'}`
      console.error('[v0] SignupForm: erro inesperado', err)
      setMessage({
        type: 'error',
        text: errorMsg,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mensagem de Erro */}
      {message?.type === 'error' && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
          <span className="text-red-600 font-bold text-lg mt-0.5">!</span>
          <div>
            <p className="font-semibold text-red-900">Erro</p>
            <p className="text-red-700 text-sm">{message.text}</p>
          </div>
        </div>
      )}

      {/* Mensagem de Sucesso */}
      {message?.type === 'success' && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 flex items-start gap-3">
          <span className="text-green-600 font-bold text-lg mt-0.5">✓</span>
          <div>
            <p className="font-semibold text-green-900">Sucesso!</p>
            <p className="text-green-700 text-sm">{message.text}</p>
          </div>
        </div>
      )}

      {referralCode && (
        <div className="p-3 rounded-lg bg-accent/10 border border-accent/30 text-sm text-foreground">
          A convidar-te através de um link de referência. Após ativares a conta, quem te convidou recebe o bónus configurado.
        </div>
      )}

      {/* Nome Completo */}
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-foreground mb-2">
          Nome Completo
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Seu nome completo"
          required
          disabled={loading}
          className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          required
          disabled={loading}
          className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
        />
      </div>

      {/* Senha */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
          Senha
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          minLength={6}
          disabled={loading}
          className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
        />
        <p className="text-xs text-muted-foreground mt-1">Mínimo 6 caracteres</p>
      </div>

      {/* Botão Criar Conta */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></span>
            Criando conta...
          </span>
        ) : (
          'Criar Conta'
        )}
      </button>
    </form>
  )
}
