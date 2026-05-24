import type { SupabaseClient } from '@supabase/supabase-js'

import { isAdminEmail } from '@/lib/admin-emails'

const DEFAULT_FREE_TIER_LIMIT = 3

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
  balance: number
  canUseBonusCredit: boolean
}

export async function getFreeTierLimit(
  supabaseAdmin: SupabaseClient
): Promise<number> {
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'free_tier_message_limit')
    .maybeSingle()

  const limit = Number(data?.value ?? DEFAULT_FREE_TIER_LIMIT)
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_FREE_TIER_LIMIT
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

export async function getUserBalance(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('balance')
    .eq('id', userId)
    .maybeSingle()

  const balance = Number(profile?.balance ?? 0)
  return Number.isFinite(balance) ? balance : 0
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
  const [hasDeposited, usage, limit, balance] = await Promise.all([
    userHasDeposited(supabaseAdmin, userId, userEmail),
    getFreeTierUsage(supabaseAdmin, userId),
    getFreeTierLimit(supabaseAdmin),
    getUserBalance(supabaseAdmin, userId),
  ])

  const remaining = (used: number) =>
    hasDeposited ? limit : Math.max(0, limit - used)

  const freeExhausted = !hasDeposited && (
    usage.posts >= limit || usage.messages >= limit || usage.comments >= limit
  )
  const canUseBonusCredit = freeExhausted && balance > 0

  return {
    hasDeposited,
    postsUsed: usage.posts,
    messagesUsed: usage.messages,
    commentsUsed: usage.comments,
    postsRemaining: remaining(usage.posts),
    messagesRemaining: remaining(usage.messages),
    commentsRemaining: remaining(usage.comments),
    limit,
    balance,
    canUseBonusCredit,
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
    return { ok: true, remaining: status.limit }
  }

  const used =
    action === 'post'
      ? status.postsUsed
      : action === 'message'
        ? status.messagesUsed
        : status.commentsUsed

  if (used >= status.limit) {
    if (status.balance > 0) {
      return { ok: true, remaining: 0 }
    }

    const labels = {
      post: 'publicações',
      message: 'mensagens',
      comment: 'comentários',
    }
    return {
      ok: false,
      error: 'DEPOSIT_REQUIRED',
      message: `Atingiste o limite de ${status.limit} ${labels[action]} gratuitas. Realiza um depósito para continuar.`,
      status,
    }
  }

  return { ok: true, remaining: status.limit - used - 1 }
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
