import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    if (!story) return NextResponse.json({ error: 'Estado não encontrado' }, { status: 404 })
    if (story.user_id !== user.id) {
      return NextResponse.json({ error: 'Só podes eliminar os teus próprios estados' }, { status: 403 })
    }

    await supabaseAdmin.from('stories').delete().eq('id', id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Stories] delete error:', error)
    return NextResponse.json({ error: 'Failed to delete story' }, { status: 500 })
  }
}
