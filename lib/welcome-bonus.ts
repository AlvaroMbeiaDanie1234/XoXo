import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureProfileWithReferralCode } from '@/lib/referrals'
import { syncProfileBalance } from '@/lib/sync-balance'

const WELCOME_BONUS_DESCRIPTION = 'Bónus de boas-vindas'

export async function getWelcomeBonusAmount(
  supabaseAdmin: SupabaseClient
): Promise<number> {
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'welcome_bonus_amount')
    .maybeSingle()

  const amount = Number(data?.value ?? 1500)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

export async function processWelcomeBonus(
  supabaseAdmin: SupabaseClient,
  userId: string,
  email?: string | null,
  displayName?: string | null
): Promise<{ credited: boolean; amount: number }> {
  const bonusAmount = await getWelcomeBonusAmount(supabaseAdmin)
  if (bonusAmount <= 0) {
    return { credited: false, amount: 0 }
  }

  const { data: existingTx } = await supabaseAdmin
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('description', WELCOME_BONUS_DESCRIPTION)
    .maybeSingle()

  if (existingTx) {
    return { credited: false, amount: 0 }
  }

  await ensureProfileWithReferralCode(
    supabaseAdmin,
    userId,
    email,
    displayName
  )

  const { error: txError } = await supabaseAdmin.from('transactions').insert({
    user_id: userId,
    amount: bonusAmount,
    type: 'deposit',
    status: 'completed',
    description: WELCOME_BONUS_DESCRIPTION,
  })

  if (txError) {
    console.error('[WelcomeBonus] Erro ao creditar:', txError)
    throw txError
  }

  await syncProfileBalance(supabaseAdmin, userId)

  return { credited: true, amount: bonusAmount }
}
