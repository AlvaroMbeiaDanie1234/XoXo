import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { userId, userEmail } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // Get the auth user ID from the profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, phone')
      .eq('id', userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
    }

    // Use provided email or profile email
    const email = userEmail || profile.email

    // Reset password using Supabase admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: 'xoxo12345'
    })

    if (updateError) {
      console.error('[Reset Password API Error]', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Send SMS to user with new password
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          body: `A tua senha foi resetada pelo admin. Nova senha: xoxo12345. Por favor, altera-a após o login.`
        })
      })
    } catch (smsError) {
      console.error('[Reset Password] SMS error:', smsError)
    }

    // Send email to user with new password (only if email is available)
    if (email) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            subject: 'Senha Resetada - XoXo',
            body: `A tua senha foi resetada pelo admin. Nova senha: xoxo12345. Por favor, altera-a após o login.`
          })
        })
      } catch (emailError) {
        console.error('[Reset Password] Email error:', emailError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Reset Password API]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
