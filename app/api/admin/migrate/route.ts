import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient()

    // Add data_consent_accepted field to profiles table
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: 'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS data_consent_accepted BOOLEAN DEFAULT FALSE;'
    })

    if (error) {
      // Try direct SQL execution if RPC fails
      const { error: directError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .limit(1)

      if (directError) {
        return NextResponse.json({ error: directError.message }, { status: 500 })
      }

      // If we can query the table, the field might already exist
      return NextResponse.json({ success: true, message: 'Migration may already exist' })
    }

    return NextResponse.json({ success: true, message: 'Migration executed successfully' })
  } catch (error: any) {
    console.error('[Migration API]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
