import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SUPERADMIN_EMAIL } from '@/lib/admin-emails'
import { assertFreeTierAction, getFreeTierStatus } from '@/lib/free-tier'
import { getSuspensionStatus } from '@/lib/assert-suspended'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = createAdminClient()

    const { receiver_id, content, file_url, file_name, file_type } = await request.json()

    if (!receiver_id || (!content?.trim() && !file_url)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    // Check if sender is suspended — only allow messaging superadmin
    const suspension = await getSuspensionStatus(supabaseAdmin, user.id)
    if (suspension.suspended) {
      const { data: receiver } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', receiver_id)
        .maybeSingle()

      if (!receiver || receiver.email?.toLowerCase() !== SUPERADMIN_EMAIL) {
        return NextResponse.json(
          { error: 'A sua conta está suspensa. Só pode contactar o suporte (superadmin.xoxo@gmail.com).', suspension },
          { status: 403 }
        )
      }
    }

    const check = await assertFreeTierAction(
      supabaseAdmin,
      user.id,
      'message',
      user.email
    )

    if (!check.ok) {
      return NextResponse.json(
        { error: check.error, message: check.message, status: check.status },
        { status: 403 }
      )
    }

    // Check if free tier is exhausted and deduct from balance
    const status = await getFreeTierStatus(supabaseAdmin, user.id, user.email)
    if (!status.hasDeposited && status.messagesRemaining === 0 && status.balance > 0) {
      // Get message cost from system settings (default to 1 AOA)
      const { data: costSetting } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'message_cost')
        .maybeSingle()

      const messageCost = Math.max(1, Number(costSetting?.value || 1))

      // Deduct from balance
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('balance')
        .eq('id', user.id)
        .single()

      const currentBalance = Number(profile?.balance || 0)
      if (currentBalance < messageCost) {
        return NextResponse.json(
          { error: 'Saldo insuficiente para enviar mensagem' },
          { status: 403 }
        )
      }

      await supabaseAdmin
        .from('profiles')
        .update({ balance: currentBalance - messageCost })
        .eq('id', user.id)

      // Record transaction
      await supabaseAdmin.from('transactions').insert({
        user_id: user.id,
        type: 'message',
        amount: messageCost,
        status: 'completed',
        description: `Desconto de ${messageCost} AOA por envio de mensagem`,
      })
    }

    const insertData: Record<string, string> = {
      sender_id: user.id,
      receiver_id,
      content: (content || '').trim(),
    }
    if (file_url) insertData.file_url = file_url
    if (file_name) insertData.file_name = file_name
    if (file_type) insertData.file_type = file_type

    const { data, error } = await supabaseAdmin.from('messages').insert(insertData).select().single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('[Messages] send error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
