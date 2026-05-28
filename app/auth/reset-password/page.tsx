'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const DEFAULT_SITE_URL = 'https://www.xoxo.ao'

function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL
  const urlWithProtocol = /^https?:\/\//i.test(configuredUrl)
    ? configuredUrl
    : `https://${configuredUrl}`

  return urlWithProtocol.replace(/\/+$/, '')
}

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const siteUrl = getSiteUrl()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${siteUrl}/auth/callback?next=/auth/update-password`,
      })

      if (resetError) {
        setError(resetError.message || 'Erro ao enviar email de recuperação')
        setLoading(false)
        return
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err?.message || 'Erro ao enviar email de recuperação')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Recuperar Senha</h1>
            <p className="text-gray-600">Digite seu email para receber um link de recuperação</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-100 border border-red-400 text-red-700 text-sm">
              <p className="font-semibold mb-1">Erro:</p>
              <p>{error}</p>
            </div>
          )}

          {success ? (
            <div className="text-center">
              <div className="mb-6 p-4 rounded-lg bg-green-100 border border-green-400 text-green-700 text-sm">
                <p className="font-semibold">Email enviado com sucesso!</p>
                <p className="mt-1">Verifique sua caixa de entrada para o link de recuperação.</p>
              </div>
              <button
                onClick={() => router.push('/auth/login')}
                className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-semibold hover:opacity-90 transition"
              >
                Voltar ao Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary transition"
                  placeholder="seu@email.com"
                  required
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block animate-spin">⟳</span>
                    Enviando...
                  </span>
                ) : (
                  'Enviar Link de Recuperação'
                )}
              </button>

              <div className="text-center">
                <Link href="/auth/login" className="text-sm text-primary hover:underline">
                  Voltar ao Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
