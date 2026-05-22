import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertFreeTierAction } from '@/lib/free-tier'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { receiver_id, content } = await request.json()

    if (!receiver_id || !content?.trim()) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()
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

    const { data, error } = await supabaseAdmin.from('messages').insert({
      sender_id: user.id,
      receiver_id,
      content: content.trim(),
    }).select().single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('[Messages] send error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
