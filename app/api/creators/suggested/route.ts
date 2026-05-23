import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchSuggestedCreators } from '@/lib/creators'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const supabaseAdmin = createAdminClient()
    const creators = await fetchSuggestedCreators(supabaseAdmin, user?.id ?? null)

    return NextResponse.json(creators)
  } catch (error) {
    console.error('[Creators] suggested error:', error)
    return NextResponse.json({ error: 'Failed to load creators' }, { status: 500 })
  }
}
