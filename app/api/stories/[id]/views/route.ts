import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { data: views } = await supabaseAdmin
      .from('story_views')
      .select('user_id, created_at, profiles!story_views_user_id_fkey(display_name, avatar_url)')
      .eq('story_id', id)
      .order('created_at', { ascending: false })

    return NextResponse.json(views || [])
  } catch (error) {
    console.error('[Stories] views error:', error)
    return NextResponse.json({ error: 'Failed to fetch views' }, { status: 500 })
  }
}
