import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabaseAdmin = createAdminClient()

    const { data: story } = await supabaseAdmin
      .from('stories')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })

    if (story.user_id === user.id) {
      return NextResponse.json({ success: true })
    }

    await supabaseAdmin
      .from('story_views')
      .upsert(
        { story_id: id, user_id: user.id },
        { onConflict: 'story_id,user_id', ignoreDuplicates: true }
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Stories] view error:', error)
    return NextResponse.json({ error: 'Failed to record view' }, { status: 500 })
  }
}
