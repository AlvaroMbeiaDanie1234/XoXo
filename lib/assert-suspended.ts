import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPERADMIN_EMAIL } from '@/lib/admin-emails'

export interface SuspensionStatus {
  suspended: boolean
  reason: string | null
  suspendedAt: string | null
}

export async function getSuspensionStatus(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<SuspensionStatus> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('suspended, suspension_reason, suspended_at')
    .eq('id', userId)
    .maybeSingle()

  if (!data?.suspended) {
    return { suspended: false, reason: null, suspendedAt: null }
  }

  return {
    suspended: true,
    reason: data.suspension_reason,
    suspendedAt: data.suspended_at,
  }
}

export async function assertNotSuspended(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const status = await getSuspensionStatus(supabaseAdmin, userId)
  if (status.suspended) {
    return {
      ok: false,
      error: status.reason || 'A sua conta foi suspensa.',
    }
  }
  return { ok: true }
}

export function isSuperAdminEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase() === SUPERADMIN_EMAIL
}
