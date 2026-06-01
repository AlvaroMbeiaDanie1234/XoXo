import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('favorites')
      .select(`
        id,
        post_id,
        posts(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching favorites:', error)
    return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 })
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

    const { post_id } = await request.json()

    const supabaseAdmin = createAdminClient()

    const { data, error } = await supabaseAdmin
      .from('favorites')
      .insert({
        user_id: user.id,
        post_id,
      })
      .select()

    if (error) throw error

    // Fetch post creator to send notification
    const { data: postData } = await supabaseAdmin
      .from('posts')
      .select('user_id, title')
      .eq('id', post_id)
      .single()

    if (postData && postData.user_id !== user.id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()

      const likerName = profile?.display_name || user.email

      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: postData.user_id,
          title: 'Nova Curitida',
          message: `${likerName} gostou do teu conteúdo: "${postData.title}"`,
          type: 'favorite',
          post_id,
          is_read: false
        })
    }

    return NextResponse.json(data[0], { status: 201 })
  } catch (error) {
    console.error('Error adding favorite:', error)
    return NextResponse.json({ error: 'Failed to add favorite' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const post_id = searchParams.get('post_id')

    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('post_id', post_id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing favorite:', error)
    return NextResponse.json({ error: 'Failed to remove favorite' }, { status: 500 })
  }
}
