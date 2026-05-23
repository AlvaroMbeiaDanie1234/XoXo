import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Recalcula o saldo do perfil a partir das transações concluídas (fonte de verdade).
 */
export async function syncProfileBalance(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: transactions, error } = await supabaseAdmin
    .from('transactions')
    .select('amount, type')
    .eq('user_id', userId)
    .eq('status', 'completed')

  if (error) throw error

  const balance = (transactions || []).reduce((sum, t) => {
    const amount = Number(t.amount) || 0
    if (t.type === 'deposit' || t.type === 'earnings') return sum + amount
    if (t.type === 'withdraw' || t.type === 'purchase') return sum - amount
    return sum
  }, 0)

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ balance })
    .eq('id', userId)

  if (updateError) throw updateError

  return balance
}
