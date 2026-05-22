import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFlutterwaveKeys, initializeFlutterwavePayment } from '@/lib/flutterwave'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { amount } = await request.json()
    const depositAmount = Number(amount)

    if (!depositAmount || depositAmount < 100) {
      return NextResponse.json(
        { error: 'O valor mínimo de depósito é AOA 100' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminClient()
    const keys = await getFlutterwaveKeys(supabaseAdmin)

    if (!keys) {
      return NextResponse.json(
        { error: 'Flutterwave não configurado no servidor' },
        { status: 500 }
      )
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('display_name, email')
      .eq('id', user.id)
      .single()

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? request.nextUrl.origin
    const txRef = `xoxo-${user.id.slice(0, 8)}-${Date.now()}`

    const { link } = await initializeFlutterwavePayment({
      secretKey: keys.secretKey,
      txRef,
      amount: depositAmount,
      email: profile?.email || user.email || '',
      name: profile?.display_name || user.email?.split('@')[0] || 'Utilizador',
      redirectUrl: `${baseUrl}/dashboard?mode=wallet&view=deposit&status=success`,
      userId: user.id,
    })

    return NextResponse.json({
      link,
      tx_ref: txRef,
      public_key: keys.publicKey,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao iniciar pagamento'
    console.error('[Flutterwave] initialize error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
