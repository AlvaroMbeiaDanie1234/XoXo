import type { SupabaseClient } from '@supabase/supabase-js'

export interface FlutterwaveKeys {
  publicKey: string
  secretKey: string
  encryptionKey: string
  webhookHash: string
}

export async function getFlutterwaveKeys(
  supabaseAdmin?: SupabaseClient
): Promise<FlutterwaveKeys | null> {
  let publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY
  let secretKey = process.env.FLUTTERWAVE_SECRET_KEY
  let encryptionKey = process.env.FLUTTERWAVE_ENCRYPTION_KEY
  let webhookHash =
    process.env.FLUTTERWAVE_WEBHOOK_HASH || process.env.FLUTTERWAVE_SECRET_KEY

  if (supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'FLUTTERWAVE_PUBLIC_KEY',
          'FLUTTERWAVE_SECRET_KEY',
          'FLUTTERWAVE_ENCRYPTION_KEY',
          'FLUTTERWAVE_WEBHOOK_HASH',
        ])

      if (data) {
        const find = (k: string) => data.find((s) => s.key === k)?.value
        publicKey = find('FLUTTERWAVE_PUBLIC_KEY') || publicKey
        secretKey = find('FLUTTERWAVE_SECRET_KEY') || secretKey
        encryptionKey = find('FLUTTERWAVE_ENCRYPTION_KEY') || encryptionKey
        webhookHash = find('FLUTTERWAVE_WEBHOOK_HASH') || webhookHash
      }
    } catch {
      // fallback to env
    }
  }

  if (!publicKey || !secretKey) return null

  return {
    publicKey,
    secretKey,
    encryptionKey: encryptionKey || '',
    webhookHash: webhookHash || secretKey,
  }
}

export async function initializeFlutterwavePayment(params: {
  secretKey: string
  txRef: string
  amount: number
  currency?: string
  email: string
  name: string
  redirectUrl: string
  userId: string
}): Promise<{ link: string }> {
  const response = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref: params.txRef,
      amount: params.amount,
      currency: params.currency || 'AOA',
      redirect_url: params.redirectUrl,
      customer: {
        email: params.email,
        name: params.name,
      },
      customizations: {
        title: 'XoXo — Carregar Carteira',
        description: `Depósito de ${params.amount.toLocaleString()} AOA`,
        logo: '',
      },
      meta: {
        user_id: params.userId,
      },
    }),
  })

  const result = await response.json()

  if (result.status !== 'success' || !result.data?.link) {
    throw new Error(result.message || 'Falha ao iniciar pagamento Flutterwave')
  }

  return { link: result.data.link }
}

export async function verifyFlutterwaveTransaction(
  transactionId: number | string,
  secretKey: string
): Promise<{ success: boolean; amount: number; currency: string; txRef: string }> {
  const response = await fetch(
    `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
    }
  )

  const result = await response.json()
  const data = result.data

  if (result.status !== 'success' || data?.status !== 'successful') {
    return { success: false, amount: 0, currency: 'AOA', txRef: '' }
  }

  return {
    success: true,
    amount: Number(data.amount),
    currency: data.currency || 'AOA',
    txRef: data.tx_ref,
  }
}
