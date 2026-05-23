'use client'

import Link from 'next/link'
import { Camera, Phone, AlertCircle, ArrowRight } from 'lucide-react'

interface ProfileSetupBannerProps {
  missingAvatar: boolean
  missingPhone: boolean
}

export default function ProfileSetupBanner({
  missingAvatar,
  missingPhone,
}: ProfileSetupBannerProps) {
  if (!missingAvatar && !missingPhone) return null

  return (
    <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-b border-amber-200/80 shadow-sm">
      <div className="max-w-[1128px] mx-auto px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={22} className="text-amber-700" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-950">Completa o teu perfil</p>
            <p className="text-xs text-amber-900/80 mt-0.5 leading-relaxed">
              {missingAvatar && missingPhone ? (
                <>
                  Adiciona uma <strong>foto de perfil</strong> e o teu <strong>número de telefone</strong> para
                  receberes notificações SMS sobre pagamentos, levantamentos e compras, e para que outros
                  utilizadores te identifiquem com confiança na plataforma.
                </>
              ) : missingAvatar ? (
                <>
                  Carrega uma <strong>foto de perfil</strong> para personalizar a tua conta e aumentar a
                  confiança junto de criadores e compradores.
                </>
              ) : (
                <>
                  Adiciona o teu <strong>número de telefone</strong> para ativares alertas SMS sobre
                  depósitos, levantamentos e transações importantes na tua carteira.
                </>
              )}
            </p>
            <ul className="flex flex-wrap gap-2 mt-2">
              {missingAvatar && (
                <li className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-100/80 px-2 py-1 rounded-full">
                  <Camera size={12} /> Sem foto
                </li>
              )}
              {missingPhone && (
                <li className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-100/80 px-2 py-1 rounded-full">
                  <Phone size={12} /> Sem telefone
                </li>
              )}
            </ul>
          </div>
        </div>
        <Link
          href="/dashboard/profile"
          className="flex-shrink-0 inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-md transition-colors w-full sm:w-auto"
        >
          Completar perfil
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}
