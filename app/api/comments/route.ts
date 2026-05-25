import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertFreeTierAction } from '@/lib/free-tier'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const post_id = searchParams.get('post_id')

    if (!post_id) {
      return NextResponse.json({ error: 'post_id is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles:user_id(display_name, avatar_url)
      `)
      .eq('post_id', post_id)
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error('Comment creation failed: Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { post_id, content, parent_id } = await request.json()

    console.log('Comment creation request:', { user_id: user.id, post_id, content, parent_id })

    const supabaseAdmin = createAdminClient()
    const check = await assertFreeTierAction(
      supabaseAdmin,
      user.id,
      'comment',
      user.email
    )

    console.log('Free tier check result:', check)

    if (!check.ok) {
      console.error('Comment creation failed: Free tier limit reached', check)
      return NextResponse.json(
        { error: check.error, message: check.message, status: check.status },
        { status: 403 }
      )
    }

    console.log('Attempting to insert comment into database')
    const { data, error } = await supabaseAdmin
      .from('comments')
      .insert({
        user_id: user.id,
        post_id,
        content,
        parent_id: parent_id || null,
      })
      .select()

    if (error) {
      console.error('Database error inserting comment:', error)
      throw error
    }

    console.log('Comment created successfully:', data)
    return NextResponse.json(data[0], { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}
