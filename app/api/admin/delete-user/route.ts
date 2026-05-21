import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    // Verify the caller is an admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || (user.email !== 'admin.xoxo@gmail.com' && user.email !== 'superadmin.xoxo@gmail.com')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const { userId } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // 1. Delete related data first (transactions, posts, messages, etc.)
    // These may fail if tables don't exist or have cascade rules, so we catch individually
    const tablesToClean = [
      'transactions',
      'posts',
      'messages',
      'verification_requests',
      'notifications',
      'subscriptions',
    ]

    for (const table of tablesToClean) {
      try {
        await adminSupabase.from(table).delete().eq('user_id', userId)
      } catch (e) {
        // Table might not exist or might have different column name — skip
        console.warn(`Could not clean table ${table}:`, e)
      }
    }

    // 2. Delete profile record
    const { error: profileError } = await adminSupabase.from('profiles').delete().eq('id', userId)
    if (profileError) {
      console.warn('Profile delete error:', profileError)
    }

    // 3. Delete auth user
    const { error: authError } = await adminSupabase.auth.admin.deleteUser(userId)
    if (authError) {
      console.warn('Auth delete error:', authError)
      // If profile was deleted but auth failed, still report partial success
      return NextResponse.json({ 
        success: true, 
        warning: 'Perfil removido mas a conta auth pode ainda existir: ' + authError.message 
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Delete user error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
