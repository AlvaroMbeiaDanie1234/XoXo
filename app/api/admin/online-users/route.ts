import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin-emails'

const ONLINE_WINDOW_MS = 10 * 60 * 1000

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 403 })
    }

    const since = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString()
    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin
      .from('user_sessions')
      .select('user_id')
      .gt('last_seen', since)

    if (error) {
      console.error('[Admin/OnlineUsers] Erro ao contar sessoes online:', error)
      return NextResponse.json({ error: 'Erro ao contar utilizadores online' }, { status: 500 })
    }

    const onlineUsers = new Set((data || []).map((session) => session.user_id).filter(Boolean))

    return NextResponse.json({
      count: onlineUsers.size,
      since,
    })
  } catch (error) {
    console.error('[Admin/OnlineUsers] Erro inesperado:', error)
    return NextResponse.json({ error: 'Erro ao contar utilizadores online' }, { status: 500 })
  }
}
