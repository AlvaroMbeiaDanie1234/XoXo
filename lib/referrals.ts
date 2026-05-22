import type { SupabaseClient } from '@supabase/supabase-js'

export function buildReferralCode(userId: string): string {
  return userId.replace(/-/g, '').slice(0, 10).toUpperCase()
}

export async function resolveReferrerId(
  supabaseAdmin: SupabaseClient,
  referralCode: string | null | undefined
): Promise<string | null> {
  if (!referralCode?.trim()) return null

  const code = referralCode.trim().toUpperCase()
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('referral_code', code)
    .maybeSingle()

  if (error) {
    console.error('[Referrals] Erro ao resolver código:', error)
    return null
  }

  return data?.id ?? null
}

export async function getReferralBonusAmount(
  supabaseAdmin: SupabaseClient
): Promise<number> {
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'referral_bonus_amount')
    .maybeSingle()

  const amount = Number(data?.value ?? 0)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

export async function ensureProfileWithReferralCode(
  supabaseAdmin: SupabaseClient,
  userId: string,
  email?: string | null,
  displayName?: string | null
): Promise<string> {
  const code = buildReferralCode(userId)

  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id, referral_code')
    .eq('id', userId)
    .maybeSingle()

  if (existing) {
    if (!existing.referral_code) {
      await supabaseAdmin
        .from('profiles')
        .update({ referral_code: code })
        .eq('id', userId)
    }
    return existing.referral_code || code
  }

  await supabaseAdmin.from('profiles').insert({
    id: userId,
    email: email ?? undefined,
    display_name: displayName ?? email?.split('@')[0] ?? 'Utilizador',
    referral_code: code,
    balance: 0,
  })

  return code
}

export async function processReferralBonus(
  supabaseAdmin: SupabaseClient,
  newUserId: string,
  referredById: string | null,
  newUserEmail?: string | null,
  newUserDisplayName?: string | null
): Promise<{ credited: boolean; amount: number }> {
  if (!referredById || referredById === newUserId) {
    return { credited: false, amount: 0 }
  }

  await ensureProfileWithReferralCode(
    supabaseAdmin,
    newUserId,
    newUserEmail,
    newUserDisplayName
  )

  const { data: newProfile } = await supabaseAdmin
    .from('profiles')
    .select('referral_bonus_paid_at')
    .eq('id', newUserId)
    .single()

  if (newProfile?.referral_bonus_paid_at) {
    return { credited: false, amount: 0 }
  }

  const { data: existingReferral } = await supabaseAdmin
    .from('referrals')
    .select('id')
    .eq('referred_id', newUserId)
    .maybeSingle()

  if (existingReferral) {
    return { credited: false, amount: 0 }
  }

  const bonusAmount = await getReferralBonusAmount(supabaseAdmin)
  if (bonusAmount <= 0) {
    await supabaseAdmin
      .from('profiles')
      .update({ referred_by: referredById })
      .eq('id', newUserId)
    return { credited: false, amount: 0 }
  }

  const paidAt = new Date().toISOString()

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      referred_by: referredById,
      referral_bonus_paid_at: paidAt,
    })
    .eq('id', newUserId)

  if (profileError) {
    console.error('[Referrals] Erro ao atualizar perfil:', profileError)
    throw profileError
  }

  const { error: txError } = await supabaseAdmin.from('transactions').insert({
    user_id: referredById,
    amount: bonusAmount,
    type: 'deposit',
    status: 'completed',
    description: 'Bónus de referência — novo utilizador registado',
  })

  if (txError) {
    console.error('[Referrals] Erro ao creditar bónus:', txError)
    throw txError
  }

  const { error: refError } = await supabaseAdmin.from('referrals').insert({
    referrer_id: referredById,
    referred_id: newUserId,
    bonus_amount: bonusAmount,
    status: 'completed',
  })

  if (refError) {
    console.error('[Referrals] Erro ao registar referência:', refError)
  }

  return { credited: true, amount: bonusAmount }
}
