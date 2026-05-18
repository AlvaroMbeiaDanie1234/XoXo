import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { filePath } = await request.json()

    if (!filePath) {
      return NextResponse.json({ error: 'filePath is required' }, { status: 400 })
    }

    // Bypass RLS using the Service Role Key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Generate a signed upload URL valid for 1 hour
    const { data, error } = await supabase.storage
      .from('media')
      .createSignedUploadUrl(filePath)

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('API Error creating signed URL:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
