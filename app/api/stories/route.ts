import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabaseAdmin = createAdminClient()
    const { data } = await supabaseAdmin
      .from('stories')
      .select('*, profiles!stories_user_id_fkey(display_name, avatar_url)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('[Stories] list error:', error)
    return NextResponse.json({ error: 'Failed to fetch stories' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { media_url, content } = await request.json()
    if (!media_url && !content?.trim()) {
      return NextResponse.json({ error: 'Adiciona uma foto ou texto para o estado' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin
      .from('stories')
      .insert({
        user_id: user.id,
        media_url: media_url || null,
        content: content?.trim() || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('[Stories] create error:', error)
    return NextResponse.json({ error: 'Failed to create story' }, { status: 500 })
  }
}
