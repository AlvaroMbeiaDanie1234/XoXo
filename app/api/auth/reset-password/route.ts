import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPublicSiteUrl } from '@/lib/site-url'
import { friendlyAuthError } from '@/lib/supabase/error-handler'
import nodemailer from 'nodemailer'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email) {
      return NextResponse.json(
        { error: 'Informe um e-mail valido.' },
        { status: 400 },
      )
    }

    const supabaseAdmin = createAdminClient()
    const siteUrl = getPublicSiteUrl()
    const recoveryRedirectUrl = `${siteUrl}/auth/update-password`

    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: recoveryRedirectUrl,
      },
    })

    if (linkError) {
      console.error('[API/ResetPassword] Falha ao gerar link de recuperacao:', linkError.message)
      return NextResponse.json({ success: true })
    }

    const tokenHash = data.properties?.hashed_token

    if (!tokenHash) {
      return NextResponse.json(
        { error: 'Nao foi possivel gerar o token de recuperacao.' },
        { status: 500 },
      )
    }

    const recoveryLink = `${siteUrl}/auth/recovery?token_hash=${encodeURIComponent(tokenHash)}`
    const mailHost = process.env.MAIL_HOST || 'smtp.gmail.com'
    const mailPort = Number(process.env.MAIL_PORT || 587)
    const mailUser = process.env.MAIL_USERNAME || 'alvarombeiadanielmiguel@gmail.com'
    const mailPass = (process.env.MAIL_PASSWORD || 'oomd xlsk clkr vqgi').replace(/"/g, '')

    const transporter = nodemailer.createTransport({
      host: mailHost,
      port: mailPort,
      secure: mailPort === 465,
      auth: {
        user: mailUser,
        pass: mailPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    })

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="pt">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recuperar senha - XOXO</title>
      </head>
      <body style="margin:0;padding:0;background:#0b0b0c;font-family:Arial,Helvetica,sans-serif;color:#e4e4e7;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0b0c;padding:40px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#161618;border:1px solid #242427;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:36px 40px 18px;text-align:center;border-bottom:1px solid #242427;">
                    <h1 style="margin:0;color:#fff;font-size:32px;letter-spacing:2px;">XO<span style="color:#ff2b85;">XO</span></h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:36px 40px;line-height:1.6;">
                    <h2 style="margin:0 0 14px;color:#fff;font-size:22px;">Recuperar senha</h2>
                    <p style="margin:0 0 28px;color:#a1a1aa;font-size:15px;">
                      Recebemos um pedido para alterar a senha da tua conta. Clica no botao abaixo para definir uma nova senha.
                    </p>
                    <p style="text-align:center;margin:34px 0;">
                      <a href="${recoveryLink}" target="_blank" style="display:inline-block;background:#ff2b85;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;">
                        Criar nova senha
                      </a>
                    </p>
                    <p style="margin:0 0 22px;color:#d4d4d8;font-size:14px;background:#202023;border-left:3px solid #ff2b85;padding:16px;border-radius:6px;">
                      Se nao pediste esta recuperacao, podes ignorar este e-mail.
                    </p>
                    <p style="margin:0;color:#71717a;font-size:12px;word-break:break-all;border-top:1px solid #242427;padding-top:20px;">
                      Se o botao nao funcionar, copia e cola este link no navegador:<br>
                      <a href="${recoveryLink}" style="color:#ff2b85;">${recoveryLink}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#0e0e10;padding:22px 40px;text-align:center;color:#71717a;font-size:12px;border-top:1px solid #242427;">
                    XoXo Premium
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `

    await transporter.sendMail({
      from: `"XOXO" <${mailUser}>`,
      to: email,
      subject: 'Recuperar senha da tua conta XoXo',
      text: `Clica neste link para criar uma nova senha: ${recoveryLink}`,
      html: emailHtml,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API/ResetPassword] Erro inesperado:', error)

    return NextResponse.json(
      { error: friendlyAuthError(error?.message) },
      { status: 500 },
    )
  }
}
