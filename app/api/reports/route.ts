import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { reported_user_id, post_id, report_type, description } = await request.json()

    if (!reported_user_id || !report_type) {
      return NextResponse.json({ error: 'reported_user_id and report_type are required' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // Check if user already reported this creator/post
    const { data: existingReport } = await supabaseAdmin
      .from('reports')
      .select('id')
      .eq('reporter_id', user.id)
      .eq('reported_user_id', reported_user_id)
      .maybeSingle()

    if (existingReport) {
      return NextResponse.json({ error: 'Já denunciaste este utilizador' }, { status: 400 })
    }

    // Create report
    await supabaseAdmin.from('reports').insert({
      reporter_id: user.id,
      reported_user_id,
      post_id: post_id || null,
      report_type,
      description: description || '',
      status: 'pending'
    })

    // Send notification to admin
    await supabaseAdmin.from('notifications').insert({
      user_id: process.env.ADMIN_ID,
      title: 'Nova Denúncia',
      message: `Nova denúncia do tipo "${report_type}" recebida`,
      type: 'report',
      is_read: false
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error creating report:', error)
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
  }
}
