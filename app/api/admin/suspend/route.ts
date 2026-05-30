import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/admin-emails'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !isAdminEmail(user.email || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, reason, action } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    if (action === 'unsuspend') {
      const supabaseAdmin = createAdminClient()
      await supabaseAdmin.from('profiles').update({
        suspended: false,
        suspension_reason: null,
        suspended_at: null,
      }).eq('id', userId)

      // Send notification
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        title: 'Conta Reativada',
        message: 'A sua conta foi reativada. Já pode aceder à plataforma normalmente.',
        type: 'system',
        is_read: false,
      })

      return NextResponse.json({ success: true, message: 'Conta reativada com sucesso' })
    }

    if (!reason || reason.trim().length < 10) {
      return NextResponse.json({ error: 'O motivo deve ter pelo menos 10 caracteres' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    await supabaseAdmin.from('profiles').update({
      suspended: true,
      suspension_reason: reason,
      suspended_at: new Date().toISOString(),
    }).eq('id', userId)

    // Send in-app notification
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      title: 'Conta Suspensa',
      message: `A sua conta foi suspensa.\n\nMotivo: ${reason}\n\nCaso tenha dúvidas, entre em contacto com o suporte.`,
      type: 'system',
      is_read: false,
    })

    // Send SMS notification
    try {
      await fetch(new URL('/api/sms', request.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          body: `XoXo: A sua conta foi suspensa. Motivo: ${reason}. Contacte o suporte para mais informações.`,
        }),
      })
    } catch (smsErr) {
      console.warn('Erro ao enviar SMS de suspensão:', smsErr)
    }

    return NextResponse.json({ success: true, message: 'Conta suspensa com sucesso' })
  } catch (error) {
    console.error('Error suspending user:', error)
    return NextResponse.json({ error: 'Erro ao processar suspensão' }, { status: 500 })
  }
}
