'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShieldAlert, X } from 'lucide-react'

export default function ConsentModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    checkConsent()
  }, [])

  const checkConsent = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('data_consent_accepted')
        .eq('id', user.id)
        .single()

      if (!profile?.data_consent_accepted) {
        setIsOpen(true)
      }
    } catch (error) {
      console.error('[Consent Modal] Error checking consent:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase
        .from('profiles')
        .update({ data_consent_accepted: true })
        .eq('id', user.id)

      setIsOpen(false)
    } catch (error) {
      console.error('[Consent Modal] Error accepting consent:', error)
    }
  }

  const handleDecline = () => {
    // Redirect to logout or show message
    window.location.href = '/logout'
  }

  if (loading || !isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Consentimento de Dados Sensíveis</h2>
            </div>
            <button
              onClick={handleDecline}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4 text-sm text-gray-600">
            <p>
              Ao utilizar a plataforma XoXo, você concorda com os seguintes termos relacionados ao tratamento de dados sensíveis:
            </p>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-900">Dados que podem ser visualizados:</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Informações de perfil (nome, email, telefone)</li>
                <li>Saldo e transações financeiras</li>
                <li>Histórico de compras e vendas</li>
                <li>Conteúdo publicado e visualizado</li>
              </ul>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-red-800 mb-2">Política de Admissibilidade e Maioridade:</h3>
              <ul className="list-disc list-inside space-y-1 text-red-700">
                <li><strong>Idade Mínima Absoluta:</strong> Proibição total de registo de menores de 18 anos</li>
                <li><strong>Obrigatoriedade de KYC:</strong> Nenhuma conta de criador pode receber pagamentos sem fornecer documento de identidade oficial e selfie</li>
                <li><strong>Contas Únicas:</strong> Proibição de partilha de credenciais. O titular responde legalmente por todas as interações</li>
              </ul>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-orange-800 mb-2">Política de Uso Aceitável:</h3>
              <ul className="list-disc list-inside space-y-1 text-orange-700">
                <li><strong>Tolerância Zero:</strong> Proibição absoluta de exploração ou abuso de menores, violência extrema, discurso de ódio</li>
                <li><strong>Consentimento:</strong> Proibição de publicação de imagens íntimas de terceiros sem autorização documentada</li>
                <li><strong>Bens Digitais:</strong> A plataforma restringe-se estritamente à transação de bens digitais</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">Importante:</h3>
              <p className="text-yellow-700">
                Ao aceitar, você autoriza a plataforma a processar e armazenar seus dados de acordo com nossa Política de Privacidade e Termos de Utilização. Você pode revogar este consentimento a qualquer momento entrando em contato com o suporte.
              </p>
            </div>

            <p className="text-xs text-gray-500">
              Última atualização: {new Date().toLocaleDateString('pt-PT')}
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleDecline}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Não Aceito
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 px-4 py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 transition-colors"
            >
              Aceito e Continuo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
