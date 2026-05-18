'use client'

import { useEffect, useState } from 'react'

export interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
}

export function Toast({ message, type, duration = 4000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration])

  if (!isVisible) return null

  const colors = {
    success: {
      bg: 'bg-green-500',
      border: 'border-green-600',
    },
    error: {
      bg: 'bg-red-500',
      border: 'border-red-600',
    },
    info: {
      bg: 'bg-blue-500',
      border: 'border-blue-600',
    },
  }[type]

  const icon = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  }[type]

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 ${colors.bg} text-white px-8 py-4 rounded-lg shadow-2xl flex items-center gap-3 border-2 ${colors.border} animate-in fade-in slide-in-from-top-4 duration-300`}>
      <span className="text-2xl font-bold flex-shrink-0">{icon}</span>
      <span className="font-medium text-lg">{message}</span>
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState<ToastProps | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 4000) => {
    // Também mostrar no console para debugging
    console.log(`[Toast] ${type.toUpperCase()}: ${message}`)
    
    // Mostrar notificação visual
    setToast({ message, type, duration })
    
    // Também usar alert para garantir que o usuário veja (especialmente para erros)
    if (type === 'error') {
      setTimeout(() => {
        alert(`Erro: ${message}`)
      }, 100)
    }
    
    setTimeout(() => {
      setToast(null)
    }, duration)
  }

  return { toast, showToast }
}
