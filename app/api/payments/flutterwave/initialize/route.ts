import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFlutterwaveKeys } from '@/lib/flutterwave'
import { flutterwaveCurrency, minDepositForCurrency, resolveProfileCurrency } from '@/lib/wallet'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { amount, currency: bodyCurrency } = await request.json()
    const depositAmount = Number(amount)

    const supabaseAdmin = createAdminClient()

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('display_name, email, preferred_currency')
      .eq('id', user.id)
      .single()

    const currency = flutterwaveCurrency(
      bodyCurrency || resolveProfileCurrency(profile)
    )
    const minDeposit = minDepositForCurrency(currency)

    if (!depositAmount || depositAmount < minDeposit) {
      return NextResponse.json(
        { error: `O valor mínimo de depósito é ${minDeposit} ${currency}` },
        { status: 400 }
      )
    }

    await getFlutterwaveKeys(supabaseAdmin)
    return NextResponse.json(
      {
        error:
          'Canal de depósito temporariamente indisponível. Estamos a atualizar a API de pagamentos. Tente novamente mais tarde.',
      },
      { status: 503 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao iniciar pagamento'
    console.error('[Flutterwave] initialize error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
