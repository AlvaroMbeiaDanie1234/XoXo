import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin-emails'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { message, userIds } = await request.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Mensagem é obrigatória' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // Fetch TelcoSMS config
    const { data: dbSettings } = await supabaseAdmin
      .from('system_settings')
      .select('*')
      .in('key', ['TELCOSMS_API_KEY', 'TELCOSMS_SUSPENDED_GLOBAL'])

    let apiKey = process.env.TELCOSMS_API_KEY || 'prd02d5c425d862fc78245c5eaeef'
    let suspendedGlobal = false

    if (dbSettings) {
      const dbKey = dbSettings.find(s => s.key === 'TELCOSMS_API_KEY')?.value
      const dbSuspended = dbSettings.find(s => s.key === 'TELCOSMS_SUSPENDED_GLOBAL')?.value
      if (dbKey) apiKey = dbKey
      if (dbSuspended === 'true') suspendedGlobal = true
    }

    if (suspendedGlobal) {
      return NextResponse.json({ error: 'SMS globalmente suspenso' }, { status: 403 })
    }

    // Fetch target users with phone numbers
    let query = supabaseAdmin
      .from('profiles')
      .select('id, phone, sms_suspended_by_admin, sms_notifications_enabled')
      .not('phone', 'is', null)

    if (userIds && userIds.length > 0) {
      query = query.in('id', userIds)
    }

    const { data: profiles } = await query

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, total: 0, error: 'Nenhum utilizador com telefone encontrado' })
    }

    let sent = 0
    let failed = 0

    for (const profile of profiles) {
      const phone = profile.phone?.trim()
      if (!phone) { failed++; continue }
      if (profile.sms_suspended_by_admin) { failed++; continue }
      if (profile.sms_notifications_enabled === false) { failed++; continue }

      let formattedPhone = phone.replace(/\D/g, '')
      if (formattedPhone.startsWith('244') && formattedPhone.length > 9) {
        formattedPhone = formattedPhone.substring(3)
      }

      try {
        const response = await fetch('https://www.telcosms.co.ao/api/v2/send_message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              api_key_app: apiKey,
              phone_number: formattedPhone,
              message_body: message.trim(),
            },
          }),
        })

        if (response.ok) {
          sent++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }

    return NextResponse.json({ sent, failed, total: profiles.length })
  } catch (error) {
    console.error('[SMS Bulk] Error:', error)
    return NextResponse.json({ error: 'Erro ao enviar SMS em massa' }, { status: 500 })
  }
}
