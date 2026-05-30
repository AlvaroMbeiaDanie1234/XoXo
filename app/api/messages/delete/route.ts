import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messageId } = await request.json()

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    const { data: message, error: fetchError } = await supabaseAdmin
      .from('messages')
      .select('sender_id')
      .eq('id', messageId)
      .single()

    if (fetchError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    if (message.sender_id !== user.id) {
      return NextResponse.json({ error: 'You can only delete your own messages' }, { status: 403 })
    }

    const { error: deleteError } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('id', messageId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Messages] delete error:', error)
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
  }
}
