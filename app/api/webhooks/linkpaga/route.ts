import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { markUserHasDeposited } from '@/lib/free-tier'

function verifyLinkPagaWebhook(rawBody: string, headerSignature: string | null, headerTimestamp: string | null, secret: string) {
  if (!headerSignature || !headerTimestamp) return false;

  // 1. Reject old timestamps (5 min tolerance)
  const ts = parseInt(headerTimestamp, 10);
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  // 2. Extract v1 signature from "t=<ts>,v1=<hex>"
  const parts = Object.fromEntries(
    headerSignature.split(",").map((p) => p.split("="))
  );
  const provided = parts.v1;
  if (!provided) return false;

  // 3. Recompute HMAC and compare in constant time
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(provided, "hex")
    );
  } catch (e) {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-linkpaga-signature");
    const timestamp = req.headers.get("x-linkpaga-timestamp");

    // Initialize default Supabase client to fetch overrides
    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const defaultSupabase = createClient(supabaseUrl, serviceRoleKey)

    let secret = process.env.LINKPAGA_WEBHOOK_SECRET || process.env.LINKPAGA_SECRET_KEY;

    try {
      const { data: dbSettings } = await defaultSupabase
        .from('system_settings')
        .select('*')
        .in('key', [
          'LINKPAGA_WEBHOOK_SECRET',
          'LINKPAGA_SECRET_KEY',
          'NEXT_PUBLIC_SUPABASE_URL',
          'SUPABASE_SERVICE_ROLE_KEY'
        ])

      if (dbSettings) {
        const dbWebhook = dbSettings.find(s => s.key === 'LINKPAGA_WEBHOOK_SECRET')?.value
        const dbSecretKey = dbSettings.find(s => s.key === 'LINKPAGA_SECRET_KEY')?.value
        const dbUrl = dbSettings.find(s => s.key === 'NEXT_PUBLIC_SUPABASE_URL')?.value
        const dbSvcKey = dbSettings.find(s => s.key === 'SUPABASE_SERVICE_ROLE_KEY')?.value

        if (dbWebhook) secret = dbWebhook
        else if (dbSecretKey) secret = dbSecretKey

        if (dbUrl) supabaseUrl = dbUrl
        if (dbSvcKey) serviceRoleKey = dbSvcKey
      }
    } catch (dbErr) {
      console.warn('Could not load settings from DB in webhook, using fallback env:', dbErr)
    }

    if (!secret) {
      console.error('Missing LinkPaga Secret Key in env variables and database settings.');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const ok = verifyLinkPagaWebhook(rawBody, signature, timestamp, secret);
    if (!ok) {
      console.error("Invalid LinkPaga Webhook Signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    console.log("🔔 Webhook LinkPaga Recebido:", event.evento);

    // Conectar ao Supabase (usando chaves potencialmente sobrescritas)
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    if (event.evento === "payment.succeeded") {
      const data = event.data;
      const clientEmail = data.cliente?.email;
      const amount = parseFloat(data.valor_bruto);
      const transactionId = data.transaction_id;

      if (!clientEmail || !amount) {
        console.error('Missing email or amount in webhook data:', data);
        return NextResponse.json({ error: 'Missing customer email or amount' }, { status: 400 });
      }

      // Find user by email in profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', clientEmail)
        .single();

      if (profileError || !profile) {
        console.error(`User not found for email ${clientEmail}. Payment successful but deposit not assigned.`);
        // Return 200 so LinkPaga doesn't retry
        return NextResponse.json({ message: 'User not found, but acknowledged.' }, { status: 200 });
      }

      // Check if this transaction_id was already processed
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('description', `Depósito LinkPaga: ${transactionId}`)
        .single();

      if (existingTx) {
        console.log(`Transaction ${transactionId} already processed.`);
        return NextResponse.json({ message: 'Already processed' }, { status: 200 });
      }

      // Insert Deposit Transaction
      const { error: insertError } = await supabase.from('transactions').insert({
        user_id: profile.id,
        amount: amount,
        type: 'deposit',
        description: `Depósito LinkPaga: ${transactionId}`,
        status: 'completed'
      });

      if (insertError) {
        console.error('Error inserting deposit transaction:', insertError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      await markUserHasDeposited(supabase, profile.id)

      console.log(`Successfully credited ${amount} to user ${clientEmail} (ID: ${profile.id}) from tx ${transactionId}`);
      
    } else if (event.evento === "payment.failed") {
      console.error("❌ Pagamento Falhou:", event.data?.error_message);
    }

    return NextResponse.json({ message: "Webhook processado com sucesso" }, { status: 200 });

  } catch (error: any) {
    console.error("Erro no Webhook:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
