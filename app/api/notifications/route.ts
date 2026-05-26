import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { user_id, title, message, type } = await request.json()

    if (!user_id || !title || !message) {
      return NextResponse.json({ error: 'user_id, title, and message are required' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    await supabaseAdmin.from('notifications').insert({
      user_id,
      title,
      message,
      type: type || 'system',
      is_read: false
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error creating notification:', error)
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 })
  }
}
