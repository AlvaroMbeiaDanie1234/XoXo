export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function getContentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    video: 'Vídeo',
    article: 'Artigo',
    photo: 'Foto',
  }
  return labels[type] || type
}

export function getContentTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    video: '🎬',
    article: '📝',
    photo: '📸',
  }
  return icons[type] || '📄'
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
