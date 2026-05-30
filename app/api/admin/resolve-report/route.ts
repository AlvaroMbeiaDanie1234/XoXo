import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(request: NextRequest) {
  try {
    const { reportId, status, response } = await request.json()

    if (!reportId) {
      return NextResponse.json({ error: 'reportId is required' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    const updateData: Record<string, unknown> = {
      status: status || 'resolved',
      updated_at: new Date().toISOString(),
    }

    if (response) {
      updateData.admin_response = response
    }

    const { error } = await supabaseAdmin
      .from('reports')
      .update(updateData)
      .eq('id', reportId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error resolving report:', err)
    return NextResponse.json({ error: err.message || 'Failed to resolve report' }, { status: 500 })
  }
}
