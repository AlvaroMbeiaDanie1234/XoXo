import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFreeTierStatus } from '@/lib/free-tier'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = createAdminClient()
    const status = await getFreeTierStatus(supabaseAdmin, user.id, user.email)

    return NextResponse.json(status)
  } catch (error) {
    console.error('[FreeTier] status error:', error)
    return NextResponse.json({ error: 'Failed to load status' }, { status: 500 })
  }
}
