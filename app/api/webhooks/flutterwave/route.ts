import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('verif-hash')

    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const defaultSupabase = createClient(supabaseUrl, serviceRoleKey)

    let webhookSecret = process.env.FLUTTERWAVE_WEBHOOK_SECRET
    let secretKey = process.env.FLUTTERWAVE_SECRET_KEY

    try {
      const { data: dbSettings } = await defaultSupabase
        .from('system_settings')
        .select('*')
        .in('key', [
          'FLUTTERWAVE_WEBHOOK_SECRET',
          'FLUTTERWAVE_SECRET_KEY',
          'NEXT_PUBLIC_SUPABASE_URL',
          'SUPABASE_SERVICE_ROLE_KEY'
        ])

      if (dbSettings) {
        const dbWebhookSecret = dbSettings.find(s => s.key === 'FLUTTERWAVE_WEBHOOK_SECRET')?.value
        const dbSecretKey = dbSettings.find(s => s.key === 'FLUTTERWAVE_SECRET_KEY')?.value
        const dbUrl = dbSettings.find(s => s.key === 'NEXT_PUBLIC_SUPABASE_URL')?.value
        const dbSvcKey = dbSettings.find(s => s.key === 'SUPABASE_SERVICE_ROLE_KEY')?.value

        if (dbWebhookSecret) webhookSecret = dbWebhookSecret
        if (dbSecretKey) secretKey = dbSecretKey
        if (dbUrl) supabaseUrl = dbUrl
        if (dbSvcKey) serviceRoleKey = dbSvcKey
      }
    } catch (dbErr) {
      console.warn('Could not load settings from DB in webhook, using fallback env:', dbErr)
    }

    // Verify webhook signature
    if (webhookSecret && signature !== webhookSecret) {
      console.error('Invalid Flutterwave webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(rawBody)
    console.log('🔔 Webhook Flutterwave Recebido:', event.event)

    if (event.event !== 'charge.completed' || event.data?.status !== 'successful') {
      return NextResponse.json({ message: 'Event acknowledged' }, { status: 200 })
    }

    if (!secretKey) {
      console.error('Missing Flutterwave Secret Key for verification')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    const transactionId = event.data.id
    const txRef = event.data.tx_ref

    // Verify the transaction with Flutterwave API
    const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    })

    const verifyData = await verifyRes.json()

    if (verifyData.status !== 'success' || verifyData.data?.status !== 'successful') {
      console.error('Flutterwave webhook verification failed:', verifyData)
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
    }

    const paymentData = verifyData.data
    const amount = paymentData.amount
    const customerEmail = paymentData.customer?.email

    if (!customerEmail || !amount) {
      console.error('Missing email or amount in webhook data:', paymentData)
      return NextResponse.json({ error: 'Missing data' }, { status: 400 })
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
      return NextResponse.json({ message: 'User not found, acknowledged' }, { status: 200 })
    }

    // Check if already processed
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('description', `Depósito Flutterwave: ${transactionId}`)
      .single()

    if (existingTx) {
      return NextResponse.json({ message: 'Already processed' }, { status: 200 })
    }

    // Insert transaction
    const { error: insertError } = await supabase.from('transactions').insert({
      user_id: profile.id,
      amount: amount,
      type: 'deposit',
      description: `Depósito Flutterwave: ${transactionId}`,
      status: 'completed'
    })

    if (insertError) {
      console.error('Error inserting deposit transaction:', insertError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    console.log(`Flutterwave webhook: Credited ${amount} to user ${customerEmail} (ID: ${profile.id})`)

    return NextResponse.json({ message: 'Webhook processed successfully' }, { status: 200 })
  } catch (error: any) {
    console.error('Flutterwave webhook error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
