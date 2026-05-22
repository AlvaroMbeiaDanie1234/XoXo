import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertFreeTierAction } from '@/lib/free-tier'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const contentType = searchParams.get('type')

    let query = supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id(display_name, avatar_url),
        favorites(id),
        comments(id)
      `)
      .order('created_at', { ascending: false })

    if (contentType && contentType !== 'all') {
      query = query.eq('content_type', contentType)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching posts:', error)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = createAdminClient()
    const check = await assertFreeTierAction(supabaseAdmin, user.id, 'post', user.email)
    if (!check.ok) {
      return NextResponse.json(
        { error: check.error, message: check.message, status: check.status },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, description, content_type, content_url, thumbnail_url } = body

    const { data, error } = await supabaseAdmin
      .from('posts')
      .insert({
        user_id: user.id,
        title,
        description,
        content_type,
        content_url,
        thumbnail_url,
      })
      .select()

    if (error) throw error

    return NextResponse.json(data[0], { status: 201 })
  } catch (error) {
    console.error('Error creating post:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}
