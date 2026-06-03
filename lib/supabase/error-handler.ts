const RESTRICTED_KEYWORDS = [
  'restricted',
  'exceed_cached_egress_quota',
  'exceeded',
  'egress quota',
  'upgrade their plan',
  'remove spend caps',
  'Payment Required',
  '402',
]

export function friendlyAuthError(message: string): string {
  if (!message) return 'Estamos em manutenção. Brevemente estaremos disponíveis.'
  const lower = message.toLowerCase()
  if (RESTRICTED_KEYWORDS.some(k => lower.includes(k))) {
    return 'Estamos em manutenção. Brevemente estaremos disponíveis.'
  }
  return message
}
