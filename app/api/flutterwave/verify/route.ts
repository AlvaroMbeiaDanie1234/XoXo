import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const { transaction_id, tx_ref } = await req.json()

    if (!transaction_id || !tx_ref) {
      return NextResponse.json({ error: 'Missing transaction_id or tx_ref' }, { status: 400 })
    }

    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const defaultSupabase = createClient(supabaseUrl, serviceRoleKey)

    let secretKey = process.env.FLUTTERWAVE_SECRET_KEY

    try {
      const { data: dbSettings } = await defaultSupabase
        .from('system_settings')
        .select('*')
        .in('key', [
          'FLUTTERWAVE_SECRET_KEY',
          'NEXT_PUBLIC_SUPABASE_URL',
          'SUPABASE_SERVICE_ROLE_KEY'
        ])

      if (dbSettings) {
        const dbSecretKey = dbSettings.find(s => s.key === 'FLUTTERWAVE_SECRET_KEY')?.value
        const dbUrl = dbSettings.find(s => s.key === 'NEXT_PUBLIC_SUPABASE_URL')?.value
        const dbSvcKey = dbSettings.find(s => s.key === 'SUPABASE_SERVICE_ROLE_KEY')?.value

        if (dbSecretKey) secretKey = dbSecretKey
        if (dbUrl) supabaseUrl = dbUrl
        if (dbSvcKey) serviceRoleKey = dbSvcKey
      }
    } catch (dbErr) {
      console.warn('Could not load settings from DB, using fallback env:', dbErr)
    }

    if (!secretKey) {
      console.error('Missing Flutterwave Secret Key')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    // Verify the transaction with Flutterwave API
    const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    })

    const verifyData = await verifyRes.json()

    if (verifyData.status !== 'success' || verifyData.data?.status !== 'successful') {
      console.error('Flutterwave verification failed:', verifyData)
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
    }

    const paymentData = verifyData.data
    const amount = paymentData.amount
    const customerEmail = paymentData.customer?.email

    if (!customerEmail || !amount) {
      return NextResponse.json({ error: 'Missing customer email or amount' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Find user by email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', customerEmail)
      .single()

    if (profileError || !profile) {
      console.error(`User not found for email ${customerEmail}`)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if already processed
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('description', `Depósito Flutterwave: ${transaction_id}`)
      .single()

    if (existingTx) {
      return NextResponse.json({ message: 'Already processed', status: 'success' })
    }

    // Insert transaction
    const { error: insertError } = await supabase.from('transactions').insert({
      user_id: profile.id,
      amount: amount,
      type: 'deposit',
      description: `Depósito Flutterwave: ${transaction_id}`,
      status: 'completed'
    })

    if (insertError) {
      console.error('Error inserting deposit transaction:', insertError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    console.log(`Flutterwave: Credited ${amount} to user ${customerEmail} (ID: ${profile.id})`)

    return NextResponse.json({ message: 'Payment verified and credited', status: 'success' })
  } catch (error: any) {
    console.error('Flutterwave verify error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
