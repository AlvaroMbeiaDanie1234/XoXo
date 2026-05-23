export const ADMIN_EMAILS = [
  'admin.xoxo@gmail.com',
  'superadmin.xoxo@gmail.com',
] as const

export const SUPERADMIN_EMAIL = 'superadmin.xoxo@gmail.com'

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase() as (typeof ADMIN_EMAILS)[number])
}

export function isSuperAdminEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase() === SUPERADMIN_EMAIL
}
