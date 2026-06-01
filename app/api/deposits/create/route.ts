import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { amount } = await req.json()
    const depositAmount = Number(amount)
    if (!depositAmount || depositAmount <= 0) {
      return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    const { data: settings } = await supabaseAdmin
      .from('system_settings')
      .select('key, value')
    const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || [])

    const entityNumber = settingsMap.get('deposit_entity_number') || '00930'

    // Check for existing pending deposit
    const { data: existing } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'deposit')
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Já tens um depósito pendente. Aguarda a aprovação do administrador.' }, { status: 400 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('phone')
      .eq('id', user.id)
      .single()

    const userPhone = profile?.phone || '---'

    const { data: txn, error } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: user.id,
        amount: depositAmount,
        type: 'deposit',
        status: 'pending',
        description: `Depósito por referência | Entidade: ${entityNumber} | Referência: ${userPhone} | Telefone: ${userPhone}`,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      transaction: txn,
      entity: entityNumber,
      reference: userPhone,
      phone: userPhone,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao criar depósito'
    console.error('[Deposit Create]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
