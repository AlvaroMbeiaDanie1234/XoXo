import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin-emails'
import { syncProfileBalance } from '@/lib/sync-balance'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const { txId, userId, action } = await req.json()

    if (!txId || !userId || !action) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    if (action !== 'approve' && action !== 'cancel') {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()
    const newStatus = action === 'approve' ? 'completed' : 'cancelled'

    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({ status: newStatus })
      .eq('id', txId)

    if (updateError) throw updateError

    let newBalance: number | null = null
    if (action === 'approve') {
      newBalance = await syncProfileBalance(supabaseAdmin, userId)
    }

    // Notify user
    const title = action === 'approve' ? 'Depósito Aprovado' : 'Depósito Cancelado'
    const message = action === 'approve'
      ? `O seu depósito foi aprovado e o saldo foi creditado!`
      : `O seu pedido de depósito foi cancelado pelo administrador.`

    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        title,
        message,
        type: 'system',
      })
    } catch {} // notification is optional

    return NextResponse.json({
      success: true,
      balance: newBalance,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao processar depósito'
    console.error('[Admin Process Deposit]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
