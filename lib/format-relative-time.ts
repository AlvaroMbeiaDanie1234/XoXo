export function formatRelativeTime(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 10) return 'agora'
  if (diffSec < 60) return `há ${diffSec} segundos`

  if (diffMin === 1) return 'há 1 minuto'
  if (diffMin < 60) return `há ${diffMin} minutos`

  if (diffHour === 1) return 'há 1 hora'
  if (diffHour < 6) return `há ${diffHour} horas`

  const today = new Date()
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const dayDiff = Math.floor((todayDay.getTime() - dateDay.getTime()) / 86400000)

  if (dayDiff === 0) return 'hoje'
  if (dayDiff === 1) return 'ontem'
  if (dayDiff < 7) return `há ${dayDiff} dias`

  const yearDiff = today.getFullYear() - date.getFullYear()
  if (yearDiff === 0) {
    return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
  }
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}
