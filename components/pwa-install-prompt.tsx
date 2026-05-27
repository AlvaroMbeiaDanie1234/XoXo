'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      console.log('PWA installation accepted')
    }

    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) {
      setShowPrompt(false)
    }
  }, [])

  if (!showPrompt || !deferredPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gradient-to-r from-accent to-purple-600 rounded-2xl shadow-2xl p-6 z-[9999] animate-in slide-in-from-bottom duration-500">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors"
      >
        <X size={20} />
      </button>
      
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Download size={32} className="text-white" />
        </div>
        
        <div className="flex-1">
          <h3 className="text-white font-bold text-lg mb-1">Instalar XoXo</h3>
          <p className="text-white/90 text-sm mb-4">
            Instale o aplicativo para uma experiência melhor e acesso rápido.
          </p>
          
          <button
            onClick={handleInstall}
            className="w-full bg-white text-accent font-bold py-3 rounded-xl hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Instalar Aplicativo
          </button>
        </div>
      </div>
    </div>
  )
}
