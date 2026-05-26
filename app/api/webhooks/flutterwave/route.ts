import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getFlutterwaveKeys, verifyFlutterwaveTransaction } from '@/lib/flutterwave'
import { markUserHasDeposited } from '@/lib/free-tier'
import { syncProfileBalance } from '@/lib/sync-balance'

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('verif-hash')

    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const defaultSupabase = createClient(supabaseUrl, serviceRoleKey)

    const keys = await getFlutterwaveKeys(defaultSupabase)
    if (!keys) {
      console.error('[Flutterwave Webhook] Missing API keys')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    if (!signature || signature !== keys.webhookHash) {
      console.error('[Flutterwave Webhook] Invalid verif-hash')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(rawBody)
    console.log('[Flutterwave Webhook] Event:', event.event)

    const { data: dbSettings } = await defaultSupabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])

    if (dbSettings) {
      const dbUrl = dbSettings.find((s) => s.key === 'NEXT_PUBLIC_SUPABASE_URL')?.value
      const dbSvc = dbSettings.find((s) => s.key === 'SUPABASE_SERVICE_ROLE_KEY')?.value
      if (dbUrl) supabaseUrl = dbUrl
      if (dbSvc) serviceRoleKey = dbSvc
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    if (event.event === 'charge.completed') {
      const flwData = event.data
      const transactionId = flwData?.id
      const customerEmail = flwData?.customer?.email

      if (!transactionId) {
        return NextResponse.json({ error: 'Missing transaction id' }, { status: 400 })
      }

      const verified = await verifyFlutterwaveTransaction(transactionId, keys.secretKey)
      if (!verified.success) {
        console.error('[Flutterwave Webhook] Verification failed for tx', transactionId)
        return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
      }

      const txRef = verified.txRef || flwData?.tx_ref
      const description = `Depósito Flutterwave: ${txRef || transactionId}`

      // Get deposit fee percent from settings
      const { data: feeSetting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'deposit_fee_percent')
        .single()
      const depositFeePercent = Number(feeSetting?.value || '0')
      const feeAmount = Math.round(verified.amount * (depositFeePercent / 100))
      const netAmount = verified.amount - feeAmount

      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('description', description)
        .maybeSingle()

      if (existingTx) {
        return NextResponse.json({ message: 'Already processed' }, { status: 200 })
      }

      let userId = flwData?.meta?.user_id as string | undefined

      if (!userId && customerEmail) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', customerEmail.toLowerCase())
          .maybeSingle()
        userId = profile?.id
      }

      if (!userId) {
        console.error('[Flutterwave Webhook] User not found for', customerEmail)
        return NextResponse.json({ message: 'User not found' }, { status: 200 })
      }

      const { error: insertError } = await supabase.from('transactions').insert({
        user_id: userId,
        amount: netAmount,
        type: 'deposit',
        description,
        status: 'completed',
      })

      if (insertError) {
        console.error('[Flutterwave Webhook] Insert error:', insertError)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
      }

      // If there's a fee, record it as platform profit
      if (feeAmount > 0) {
        await supabase.from('transactions').insert({
          user_id: userId,
          amount: feeAmount,
          type: 'deposit_fee',
          description: `Taxa de processamento de depósito (${depositFeePercent}%)`,
          status: 'completed',
        })
      }

      await markUserHasDeposited(supabase, userId)
      await syncProfileBalance(supabase, userId)
      console.log(`[Flutterwave Webhook] Credited AOA ${netAmount} to ${userId} (fee: AOA ${feeAmount})`)
    }

    return NextResponse.json({ message: 'OK' }, { status: 200 })
  } catch (error) {
    console.error('[Flutterwave Webhook] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
