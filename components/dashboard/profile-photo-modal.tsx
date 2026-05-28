'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface ProfilePhotoModalProps {
  avatarUrl: string
  displayName?: string | null
}

export default function ProfilePhotoModal({ avatarUrl, displayName }: ProfilePhotoModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const label = displayName ? `Foto de perfil de ${displayName}` : 'Foto de perfil'

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Ver foto de perfil"
        className="z-20 w-fit rounded-full bg-white p-1.5 shadow-2xl shadow-black/20 transition-transform hover:scale-[1.02] dark:bg-gray-950"
      >
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-tr from-accent to-primary text-3xl font-bold text-white shadow-inner sm:h-28 sm:w-28 sm:text-4xl dark:border-gray-950">
          <img src={avatarUrl} alt={label} className="h-full w-full object-cover" />
        </div>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
              aria-label="Fechar foto"
            >
              <X size={20} />
            </button>
            <img src={avatarUrl} alt={label} className="max-h-[80vh] w-full object-contain" />
          </div>
        </div>
      )}
    </>
  )
}
