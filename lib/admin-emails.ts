export const ADMIN_EMAILS = [
  'admin.xoxo@gmail.com',
  'superadmin.xoxo@gmail.com',
] as const

export const SUPERADMIN_EMAIL = 'superadmin.xoxo@gmail.com'

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false
  const lower = email.toLowerCase().trim()
  if (ADMIN_EMAILS.some((a) => a.toLowerCase() === lower)) return true
  const envAdmins = process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim().toLowerCase()) || []
  return envAdmins.includes(lower)
}

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false
  const lower = email.toLowerCase().trim()
  return lower === SUPERADMIN_EMAIL.toLowerCase()
}
