import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdminEmail } from '@/lib/admin-emails'

const CONFIRM_PHRASE = 'APAGAR TUDO'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !isSuperAdminEmail(user.email)) {
      return NextResponse.json(
        { error: 'Apenas o superadmin pode executar esta operação.' },
        { status: 403 }
      )
    }

    const { confirmPhrase } = await req.json()
    if (confirmPhrase !== CONFIRM_PHRASE) {
      return NextResponse.json(
        { error: `Confirmação inválida. Escreve exatamente: ${CONFIRM_PHRASE}` },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminClient()

    const { count: txCountBefore } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })

    const { error: deleteTxError } = await supabaseAdmin
      .from('transactions')
      .delete()
      .not('id', 'is', null)

    if (deleteTxError) throw deleteTxError

    const { error: balanceError } = await supabaseAdmin
      .from('profiles')
      .update({
        balance: 0,
        has_deposited: false,
      })
      .not('id', 'is', null)

    if (balanceError) throw balanceError

    return NextResponse.json({
      success: true,
      deletedTransactions: txCountBefore ?? 0,
      message: 'Histórico financeiro apagado e saldos dos utilizadores zerados.',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao resetar dados financeiros'
    console.error('[Admin Reset Financials]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
