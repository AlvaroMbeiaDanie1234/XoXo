import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    console.log('Session update - User:', user?.id)

    if (!user) {
      console.log('Session update - No user found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user already has a session
    const { data: existingSession, error: selectError } = await supabase
      .from('user_sessions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (selectError) {
      console.error('Session update - Select error:', selectError)
    }

    if (existingSession) {
      console.log('Session update - Updating existing session:', existingSession.id)
      // Update last_seen
      const { error: updateError } = await supabase
        .from('user_sessions')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', existingSession.id)

      if (updateError) {
        console.error('Session update - Update error:', updateError)
      }
    } else {
      console.log('Session update - Creating new session')
      // Create new session
      const { error: insertError } = await supabase
        .from('user_sessions')
        .insert({
          user_id: user.id,
          last_seen: new Date().toISOString()
        })

      if (insertError) {
        console.error('Session update - Insert error:', insertError)
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }
}
