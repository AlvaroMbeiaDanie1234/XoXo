import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { userId, email } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Check if there's already a pending request
    const { data: existing } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Já tens um pedido de verificação pendente.' }, { status: 400 })
    }

    // 2. Mock LinkPaga API call (as we don't have real keys yet)
    // In a real scenario, you would call:
    // const res = await fetch('https://gbzazmhfsrwyecxazadm.supabase.co/functions/v1/api-v1/payment-links', { ... })
    
    const mockPaymentUrl = `https://linkpaga.com/p/verificacao-${userId.slice(0, 8)}`

    // 3. Create the request in DB
    const { data, error } = await supabase
      .from('verification_requests')
      .insert({
        user_id: userId,
        status: 'pending',
        payment_link: mockPaymentUrl
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ 
      url: mockPaymentUrl,
      message: 'Pedido de verificação iniciado. Por favor complete o pagamento.' 
    })

  } catch (err: any) {
    console.error('Error creating verification request:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
