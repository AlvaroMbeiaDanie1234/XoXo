import type { SupabaseClient } from '@supabase/supabase-js'

export const FREE_TIER_LIMIT = 3

const ADMIN_EMAILS = ['admin.xoxo@gmail.com', 'superadmin.xoxo@gmail.com']

export type FreeTierAction = 'post' | 'message' | 'comment'

export interface FreeTierStatus {
  hasDeposited: boolean
  postsUsed: number
  messagesUsed: number
  commentsUsed: number
  postsRemaining: number
  messagesRemaining: number
  commentsRemaining: number
  limit: number
}

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}

export async function userHasDeposited(
  supabaseAdmin: SupabaseClient,
  userId: string,
  userEmail?: string | null
): Promise<boolean> {
  if (isAdminEmail(userEmail)) return true

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('has_deposited, is_free_plan')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.is_free_plan || profile?.has_deposited) return true

  const { count } = await supabaseAdmin
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'deposit')
    .eq('status', 'completed')
    .or('description.ilike.Depósito Flutterwave%,description.ilike.Depósito LinkPaga%')

  return (count ?? 0) > 0
}

export async function getFreeTierUsage(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<{ posts: number; messages: number; comments: number }> {
  const [postsRes, messagesRes, commentsRes] = await Promise.all([
    supabaseAdmin
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', userId),
    supabaseAdmin
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
  ])

  return {
    posts: postsRes.count ?? 0,
    messages: messagesRes.count ?? 0,
    comments: commentsRes.count ?? 0,
  }
}

export async function getFreeTierStatus(
  supabaseAdmin: SupabaseClient,
  userId: string,
  userEmail?: string | null
): Promise<FreeTierStatus> {
  const hasDeposited = await userHasDeposited(supabaseAdmin, userId, userEmail)
  const usage = await getFreeTierUsage(supabaseAdmin, userId)

  const remaining = (used: number) =>
    hasDeposited ? FREE_TIER_LIMIT : Math.max(0, FREE_TIER_LIMIT - used)

  return {
    hasDeposited,
    postsUsed: usage.posts,
    messagesUsed: usage.messages,
    commentsUsed: usage.comments,
    postsRemaining: remaining(usage.posts),
    messagesRemaining: remaining(usage.messages),
    commentsRemaining: remaining(usage.comments),
    limit: FREE_TIER_LIMIT,
  }
}

export async function assertFreeTierAction(
  supabaseAdmin: SupabaseClient,
  userId: string,
  action: FreeTierAction,
  userEmail?: string | null
): Promise<
  | { ok: true; remaining: number }
  | { ok: false; error: 'DEPOSIT_REQUIRED'; message: string; status: FreeTierStatus }
> {
  const status = await getFreeTierStatus(supabaseAdmin, userId, userEmail)

  if (status.hasDeposited) {
    return { ok: true, remaining: FREE_TIER_LIMIT }
  }

  const used =
    action === 'post'
      ? status.postsUsed
      : action === 'message'
        ? status.messagesUsed
        : status.commentsUsed

  if (used >= FREE_TIER_LIMIT) {
    const labels = {
      post: 'publicações',
      message: 'mensagens',
      comment: 'comentários',
    }
    return {
      ok: false,
      error: 'DEPOSIT_REQUIRED',
      message: `Atingiste o limite de ${FREE_TIER_LIMIT} ${labels[action]} gratuitas. Realiza um depósito para continuar.`,
      status,
    }
  }

  return { ok: true, remaining: FREE_TIER_LIMIT - used - 1 }
}

export async function markUserHasDeposited(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<void> {
  await supabaseAdmin
    .from('profiles')
    .update({ has_deposited: true })
    .eq('id', userId)
}
