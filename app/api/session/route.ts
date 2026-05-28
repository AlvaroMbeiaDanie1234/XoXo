import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date().toISOString()
    const supabaseAdmin = createAdminClient()

    const { data: updatedSessions, error: updateError } = await supabaseAdmin
      .from('user_sessions')
      .update({ last_seen: now })
      .eq('user_id', user.id)
      .select('id')

    if (updateError) {
      console.error('Session update - Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
    }

    if (!updatedSessions?.length) {
      const { error: insertError } = await supabaseAdmin
        .from('user_sessions')
        .insert({
          user_id: user.id,
          last_seen: now,
        })

      if (insertError) {
        console.error('Session update - Insert error:', insertError)
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
      }
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ last_online: now })
      .eq('id', user.id)

    if (profileError) {
      console.warn('Session update - Profile last_online ignored:', profileError.message)
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: true }, { status: 200 })
    }

    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin
      .from('user_sessions')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('Session delete - Delete error:', error)
      return NextResponse.json({ error: 'Failed to clear session' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error clearing session:', error)
    return NextResponse.json({ error: 'Failed to clear session' }, { status: 500 })
  }
}
