'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'

interface CreatorProfileBackButtonProps {
  fallbackHref?: string
  className?: string
}

export default function CreatorProfileBackButton({
  fallbackHref = '/dashboard',
  className,
}: CreatorProfileBackButtonProps) {
  const router = useRouter()

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }

    router.push(fallbackHref)
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Voltar para a pagina anterior"
      className={cn(
        'mb-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-gray-950 dark:hover:text-accent',
        className,
      )}
    >
      <ArrowLeft size={18} />
      <span>Voltar</span>
    </button>
  )
}
