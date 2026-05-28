'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function RecoveryPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const verifyRecoveryToken = async () => {
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash')

      if (!tokenHash) {
        setError('Link de recuperacao invalido.')
        return
      }

      const supabase = createClient()
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      })

      if (verifyError) {
        setError('Link de recuperacao invalido ou expirado.')
        return
      }

      router.replace('/auth/update-password')
    }

    verifyRecoveryToken()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Recuperar Senha</h1>
          {error ? (
            <>
              <p className="text-red-700 text-sm mb-6">{error}</p>
              <Link
                href="/auth/reset-password"
                className="block w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-semibold hover:opacity-90 transition"
              >
                Pedir novo link
              </Link>
            </>
          ) : (
            <p className="text-gray-600">A validar o link de recuperacao...</p>
          )}
        </div>
      </div>
    </div>
  )
}
