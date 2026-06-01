import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin-emails'
import { syncProfileBalance } from '@/lib/sync-balance'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const { txId, userId, amount, action = 'complete' } = await req.json()

    if (!txId || !userId || !amount) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    if (action !== 'complete' && action !== 'cancel') {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()
    const newStatus = action === 'complete' ? 'completed' : 'cancelled'

    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({ status: newStatus })
      .eq('id', txId)

    if (updateError) throw updateError

    const newBalance = await syncProfileBalance(supabaseAdmin, userId)

    return NextResponse.json({
      success: true,
      balance: newBalance,
      amount: Number(amount),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao processar levantamento'
    console.error('[Admin Process Withdrawal]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
