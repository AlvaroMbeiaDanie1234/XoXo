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
  post_count?: number
}

let cachedAdminIds: { ids: Set<string>; ts: number } | null = null
const ADMIN_CACHE_TTL = 5 * 60 * 1000

export async function getAdminUserIds(): Promise<Set<string>> {
  if (cachedAdminIds && Date.now() - cachedAdminIds.ts < ADMIN_CACHE_TTL) {
    return cachedAdminIds.ids
  }

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

  cachedAdminIds = { ids, ts: Date.now() }
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

  const { data: postCountRows } = await supabaseAdmin
    .rpc('get_post_counts', {})

  let postCounts = new Map<string, number>()

  try {
    const { data: postCountRows } = await supabaseAdmin.rpc('get_post_counts', {})
    if (postCountRows) {
      postCounts = new Map(postCountRows.map((r: any) => [r.user_id, Number(r.count)]))
    }
  } catch {
    // RPC not available, fallback below
  }

  if (postCounts.size === 0) {
    const { data: fallback } = await supabaseAdmin
      .from('posts')
      .select('user_id')
      .limit(5000)

    fallback?.forEach((post: any) => {
      if (post.user_id) postCounts.set(post.user_id, (postCounts.get(post.user_id) || 0) + 1)
    })
  }

  const rankedPostCreatorIds = [...postCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([userId]) => userId)

  const topPostCreatorIds = rankedPostCreatorIds.slice(0, Math.max(limit * 4, 100))
  let creatorsWithPosts: CreatorProfile[] = []

  if (topPostCreatorIds.length > 0) {
    const { data: postCreators } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, avatar_url, email, is_verified, created_at')
      .in('id', topPostCreatorIds)

    if (postCreators) {
      const profilesById = new Map(postCreators.map((profile) => [profile.id, profile]))
      creatorsWithPosts = topPostCreatorIds
        .map((id) => profilesById.get(id))
        .filter(Boolean)
        .map((profile) => ({
          ...profile!,
          post_count: postCounts.get(profile!.id) || 0,
        }))
    }
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name, avatar_url, email, is_verified, created_at')
    .order('created_at', { ascending: false })
    .limit(limit + adminIds.size + 5)

  if (error || !data) return []

  const filteredWithPosts = filterCreatorProfiles(creatorsWithPosts, { adminIds, excludeUserId })
  const postCreatorIds = new Set(filteredWithPosts.map((creator) => creator.id))
  const filteredRecent = filterCreatorProfiles(data, { adminIds, excludeUserId })
    .filter((creator) => !postCreatorIds.has(creator.id))
    .map((creator) => ({
      ...creator,
      post_count: postCounts.get(creator.id) || 0,
    }))

  return [...filteredWithPosts, ...filteredRecent]
    .sort((a, b) => {
      if ((a.post_count || 0) !== (b.post_count || 0)) {
        return (b.post_count || 0) - (a.post_count || 0)
      }
      if (a.is_verified !== b.is_verified) {
        return (b.is_verified ? 1 : 0) - (a.is_verified ? 1 : 0)
      }
      return (
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )
    })
    .slice(0, limit)
}
