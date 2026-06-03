import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SUPERADMIN_EMAIL } from '@/lib/admin-emails'
import { getSuspensionStatus } from '@/lib/assert-suspended'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabaseAdmin = createAdminClient()
    const suspension = await getSuspensionStatus(supabaseAdmin, user.id)
    if (!suspension.suspended) {
      return NextResponse.json({ error: 'Conta não está suspensa' }, { status: 400 })
    }

    // Get superadmin's user ID
    const { data: superadmin } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', SUPERADMIN_EMAIL)
      .maybeSingle()

    if (!superadmin) {
      return NextResponse.json({ error: 'Suporte não encontrado' }, { status: 500 })
    }

    // Count messages from this user to superadmin while suspended
    const { count } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', user.id)
      .eq('receiver_id', superadmin.id)
      .gte('created_at', suspension.suspendedAt || '1970-01-01')

    const remaining = Math.max(0, 3 - (count || 0))

    // Also fetch current phone
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('phone')
      .eq('id', user.id)
      .maybeSingle()

    return NextResponse.json({
      remaining,
      totalSent: count || 0,
      phone: profile?.phone || '',
    })
  } catch (error) {
    console.error('[Suspension/Message] GET error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabaseAdmin = createAdminClient()
    const suspension = await getSuspensionStatus(supabaseAdmin, user.id)
    if (!suspension.suspended) {
      return NextResponse.json({ error: 'Conta não está suspensa' }, { status: 400 })
    }

    const { message, phone } = await request.json()
    if (!message?.trim()) {
      return NextResponse.json({ error: 'A mensagem não pode estar vazia' }, { status: 400 })
    }

    // Get superadmin's user ID
    const { data: superadmin } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', SUPERADMIN_EMAIL)
      .maybeSingle()

    if (!superadmin) {
      return NextResponse.json({ error: 'Suporte não encontrado' }, { status: 500 })
    }

    // Count existing messages sent while suspended
    const { count } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', user.id)
      .eq('receiver_id', superadmin.id)
      .gte('created_at', suspension.suspendedAt || '1970-01-01')

    if ((count || 0) >= 3) {
      return NextResponse.json(
        { error: 'Já usou as 3 mensagens permitidas. Aguarde o contacto da nossa equipa.' },
        { status: 403 }
      )
    }

    // Save the message
    const { error: msgError } = await supabaseAdmin.from('messages').insert({
      sender_id: user.id,
      receiver_id: superadmin.id,
      content: message.trim(),
    })

    if (msgError) throw msgError

      // Save phone number if provided
    if (phone?.trim()) {
      await supabaseAdmin.from('profiles').update({ phone: phone.trim() }).eq('id', user.id)
    }

    // Also register in feedbacks so the admin sees it
    await supabaseAdmin.from('feedbacks').insert({
      user_id: user.id,
      rating: 0,
      message: `[APELO DE SUSPENSÃO] ${message.trim()}`,
      created_at: new Date().toISOString(),
    }).maybeSingle()

    const newCount = (count || 0) + 1
    const remaining = Math.max(0, 3 - newCount)

    return NextResponse.json({
      success: true,
      remaining,
      totalSent: newCount,
    })
  } catch (error) {
    console.error('[Suspension/Message] POST error:', error)
    return NextResponse.json({ error: 'Erro ao enviar mensagem' }, { status: 500 })
  }
}
