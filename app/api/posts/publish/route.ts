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

    const supabaseAdmin = createAdminClient()
    const check = await assertFreeTierAction(
      supabaseAdmin,
      user.id,
      'post',
      user.email
    )

    if (!check.ok) {
      return NextResponse.json(
        { error: check.error, message: check.message, status: check.status },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      title,
      description,
      content_type,
      content_url,
      thumbnail_url,
      price,
      is_free,
    } = body

    const { data, error } = await supabaseAdmin
      .from('posts')
      .insert({
        user_id: user.id,
        title: title || 'Nova Publicação',
        description,
        content_type,
        content_url,
        thumbnail_url,
        price: parseFloat(price) || 0,
        is_free: !!is_free,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('[Posts] publish error:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}
