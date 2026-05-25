'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function PrivacyPage() {
  const [privacy, setPrivacy] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadPrivacy() {
      const { data: settings } = await supabase.from('system_settings').select('*')
      if (settings) {
        const privacySetting = settings.find(s => s.key === 'privacy_policy')
        if (privacySetting) setPrivacy(privacySetting.value)
      }
      setLoading(false)
    }
    loadPrivacy()
  }, [supabase])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        <div className="mb-6">
          <Link href="/auth/sign-up" className="text-accent hover:underline text-sm">
            ← Voltar para Cadastro
          </Link>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-border shadow-sm p-8">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-6">Política de Privacidade</h1>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 mt-4">Carregando política...</p>
            </div>
          ) : privacy ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
                {privacy}
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Política de privacidade não configurada.</p>
          )}
        </div>
      </div>
    </div>
  )
}
