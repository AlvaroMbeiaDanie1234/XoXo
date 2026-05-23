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

    const { userId, amount, description } = await req.json()
    const creditAmount = Number(amount)

    if (!userId || !creditAmount || creditAmount <= 0) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    const { error: insertError } = await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      amount: creditAmount,
      type: 'deposit',
      status: 'completed',
      description: description || 'Carregamento administrativo de saldo',
    })

    if (insertError) throw insertError

    const newBalance = await syncProfileBalance(supabaseAdmin, userId)

    return NextResponse.json({
      success: true,
      balance: newBalance,
      amount: creditAmount,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao creditar saldo'
    console.error('[Admin Credit]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
