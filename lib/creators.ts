import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin-emails'

export interface CreatorProfile {
  id: string
  display_name: string | null
  avatar_url: string | null
  is_verified?: boolean
  email?: string | null
  created_at?: string
}

export async function getAdminUserIds(): Promise<Set<string>> {
  const supabaseAdmin = createAdminClient()
  const ids = new Set<string>()
  let page = 1

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    })

    if (error || !data?.users?.length) break

    for (const u of data.users) {
      if (isAdminEmail(u.email)) ids.add(u.id)
    }

    if (data.users.length < 1000) break
    page++
  }

  return ids
}

export function filterCreatorProfiles<T extends { id: string; email?: string | null }>(
  profiles: T[],
  options: { adminIds: Set<string>; excludeUserId?: string | null }
): T[] {
  return profiles.filter((p) => {
    if (options.excludeUserId && p.id === options.excludeUserId) return false
    if (options.adminIds.has(p.id)) return false
    if (isAdminEmail(p.email)) return false
    return true
  })
}

export async function fetchSuggestedCreators(
  supabaseAdmin: SupabaseClient,
  excludeUserId?: string | null,
  limit = 50
): Promise<CreatorProfile[]> {
  const adminIds = await getAdminUserIds()

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name, avatar_url, email, is_verified, created_at')
    .order('created_at', { ascending: false })
    .limit(limit + adminIds.size + 5)

  if (error || !data) return []

  const filtered = filterCreatorProfiles(data, { adminIds, excludeUserId })

  return filtered
    .sort((a, b) => {
      if (a.is_verified !== b.is_verified) {
        return (b.is_verified ? 1 : 0) - (a.is_verified ? 1 : 0)
      }
      return (
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )
    })
    .slice(0, limit)
}
