import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import nodemailer from 'nodemailer'

export async function POST(request: NextRequest) {
  console.log('[API/Signup] Iniciando fluxo de cadastro personalizado via SMTP')

  try {
    const body = await request.json()
    const { email, password, displayName } = body

    if (!email || !password || !displayName) {
      return NextResponse.json(
        { error: 'Por favor, preencha todos os campos obrigatórios.' },
        { status: 400 }
      )
    }

    const trimmedEmail = email.trim().toLowerCase()
    const trimmedName = displayName.trim()

    const supabaseAdmin = createAdminClient()

    // 1. Verificar se o utilizador já existe no Supabase
    console.log(`[API/Signup] Verificando existência do utilizador: ${trimmedEmail}`)
    let existingUser = null
    let pageNum = 1
    
    while (true) {
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page: pageNum,
        perPage: 1000
      })
      
      if (listError || !listData?.users || listData.users.length === 0) {
        break
      }
      
      const match = listData.users.find(u => u.email?.toLowerCase() === trimmedEmail)
      if (match) {
        existingUser = match
        break
      }
      
      if (listData.users.length < 1000) {
        break
      }
      pageNum++
    }

    if (existingUser) {
      console.log(`[API/Signup] Utilizador encontrado. Confirmado em: ${existingUser.email_confirmed_at}`)
      
      if (existingUser.email_confirmed_at) {
        return NextResponse.json(
          { error: 'Este e-mail já está em uso por uma conta ativa.' },
          { status: 400 }
        )
      } else {
        // Se o utilizador existe mas NÃO está confirmado, removemos o registo incompleto
        // para permitir um novo registo limpo e envio de e-mail fresco
        console.log(`[API/Signup] Removendo registo de e-mail não confirmado: ${existingUser.id}`)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existingUser.id)
        if (deleteError) {
          console.error('[API/Signup] Erro ao deletar registo incompleto:', deleteError)
        }
      }
    }

    // 2. Gerar o link oficial de confirmação de cadastro do Supabase (sem enviar e-mail automático)
    console.log('[API/Signup] Gerando link de confirmação do Supabase')
    const origin = request.nextUrl.origin
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: trimmedEmail,
      password: password,
      options: {
        redirectTo: `${origin}/auth/callback`,
        data: {
          display_name: trimmedName,
        },
      },
    })

    if (linkError) {
      console.error('[API/Signup] Erro ao gerar link de confirmação:', linkError)
      return NextResponse.json(
        { error: `Erro ao criar conta no sistema: ${linkError.message}` },
        { status: 400 }
      )
    }

    const actionLink = linkData?.properties?.action_link
    if (!actionLink) {
      console.error('[API/Signup] Link de ação não retornado pelo Supabase.')
      return NextResponse.json(
        { error: 'Não foi possível gerar o link de ativação da conta.' },
        { status: 500 }
      )
    }

    console.log('[API/Signup] Link gerado com sucesso:', actionLink)

    // 3. Configurar e-mail com nodemailer e SMTP do Gmail
    const mailHost = process.env.MAIL_HOST || 'smtp.gmail.com'
    const mailPort = Number(process.env.MAIL_PORT || 587)
    const mailUser = process.env.MAIL_USERNAME || 'alvarombeiadanielmiguel@gmail.com'
    // Remover aspas duplas caso estejam na string
    const mailPass = (process.env.MAIL_PASSWORD || 'oomd xlsk clkr vqgi').replace(/"/g, '')

    console.log(`[API/Signup] Configurando transportador SMTP: ${mailHost}:${mailPort} como ${mailUser}`)

    const transporter = nodemailer.createTransport({
      host: mailHost,
      port: mailPort,
      secure: mailPort === 465, // secure: true para 465, false para 587
      auth: {
        user: mailUser,
        pass: mailPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    })

    // 4. HTML premium do e-mail de ativação XOXO (Preto elegante e acentos rosa vibrante)
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="pt">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ative sua Conta - XOXO</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #0b0b0c;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #e4e4e7;
          }
          .email-wrapper {
            width: 100%;
            background-color: #0b0b0c;
            padding: 40px 0;
          }
          .email-content {
            max-width: 550px;
            margin: 0 auto;
            background-color: #161618;
            border: 1px border #242427;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          }
          .email-header {
            background-color: #161618;
            padding: 40px 40px 20px 40px;
            text-align: center;
            border-bottom: 1px solid #242427;
          }
          .logo {
            font-size: 32px;
            font-weight: 800;
            color: #ffffff;
            letter-spacing: 2px;
            margin: 0;
            text-shadow: 0 0 15px rgba(255, 43, 133, 0.4);
          }
          .logo span {
            color: #ff2b85;
          }
          .email-body {
            padding: 40px;
            line-height: 1.6;
          }
          .welcome-title {
            font-size: 22px;
            font-weight: 700;
            color: #ffffff;
            margin-top: 0;
            margin-bottom: 16px;
          }
          .welcome-text {
            font-size: 15px;
            color: #a1a1aa;
            margin-bottom: 30px;
          }
          .cta-container {
            text-align: center;
            margin: 35px 0;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #ff2b85 0%, #e01a6f 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 32px;
            font-weight: 600;
            font-size: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(255, 43, 133, 0.35);
            transition: all 0.2s ease;
          }
          .cta-button:hover {
            box-shadow: 0 6px 20px rgba(255, 43, 133, 0.5);
            transform: translateY(-1px);
          }
          .info-box {
            background-color: #202023;
            border-left: 3px solid #ff2b85;
            padding: 16px;
            border-radius: 6px;
            margin-bottom: 30px;
            font-size: 14px;
            color: #d4d4d8;
          }
          .fallback-link {
            font-size: 12px;
            color: #71717a;
            word-break: break-all;
            margin-top: 25px;
            padding-top: 20px;
            border-top: 1px solid #242427;
          }
          .fallback-link a {
            color: #ff2b85;
            text-decoration: none;
          }
          .email-footer {
            background-color: #0e0e10;
            padding: 24px 40px;
            text-align: center;
            font-size: 12px;
            color: #71717a;
            border-top: 1px solid #242427;
          }
          .footer-text {
            margin: 0 0 8px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-content">
            <div class="email-header">
              <h1 class="logo">XO<span>XO</span></h1>
            </div>
            <div class="email-body">
              <h2 class="welcome-title">Olá, ${trimmedName}!</h2>
              <p class="welcome-text">
                Obrigado por te juntares ao <strong>XoXo</strong>. Para teres acesso completo a todo o conteúdo premium exclusivo, transmissões ao vivo e benefícios VIP, precisamos apenas que confirmes o teu endereço de e-mail.
              </p>
              
              <div class="cta-container">
                <a href="${actionLink}" class="cta-button" target="_blank">Confirmar Conta & Ativar Acesso</a>
              </div>

              <div class="info-box">
                <strong>Nota Importante:</strong> Este link de confirmação é válido por 24 horas. Se não criaste uma conta no XoXo, por favor ignora este e-mail.
              </div>

              <p class="welcome-text" style="margin-bottom: 0;">
                Sejam bem-vindos à plataforma mais exclusiva e sedutora.<br>
                <strong>Com carinho,<br>Equipa XOXO</strong>
              </p>

              <div class="fallback-link">
                Se tiveres problemas com o botão acima, copia e cola o seguinte link no teu navegador:<br>
                <a href="${actionLink}">${actionLink}</a>
              </div>
            </div>
            <div class="email-footer">
              <p class="footer-text">Recebeste este e-mail porque te registaste no XoXo.</p>
              <p class="footer-text" style="margin-bottom: 0;">&copy; ${new Date().getFullYear()} XoXo Premium. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `

    console.log('[API/Signup] Enviando e-mail via SMTP...')
    await transporter.sendMail({
      from: `"XOXO" <${mailUser}>`, // Remetente exatamente como solicitado
      to: trimmedEmail,
      subject: 'Ativa a tua conta XoXo 💋',
      text: `Olá, ${trimmedName}! Por favor ative sua conta no XoXo clicando no link: ${actionLink}`,
      html: emailHtml,
    })

    console.log(`[API/Signup] E-mail enviado com sucesso para ${trimmedEmail}!`)

    return NextResponse.json({
      success: true,
      message: 'Conta criada com sucesso! Por favor verifique o seu e-mail para ativar a conta.',
    })

  } catch (error: any) {
    console.error('[API/Signup] Erro crítico no fluxo de cadastro:', error)
    return NextResponse.json(
      { error: error?.message || 'Erro interno ao processar o cadastro.' },
      { status: 500 }
    )
  }
}
