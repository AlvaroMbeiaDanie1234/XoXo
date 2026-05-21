import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? request.nextUrl.origin
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  console.log(`[API/Confirm] Recebida tentativa de confirmação para: ${email}`)

  if (!token || !email) {
    console.error('[API/Confirm] Token ou e-mail em falta na requisição.')
    return NextResponse.redirect(`${baseUrl}/auth/error?message=Parâmetros de ativação inválidos ou em falta.`)
  }

  try {
    const supabaseAdmin = createAdminClient()

    // 1. Encontrar o utilizador de forma segura e robusta (paginada)
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
      
      const match = listData.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
      if (match) {
        existingUser = match
        break
      }
      
      if (listData.users.length < 1000) {
        break
      }
      pageNum++
    }

    if (!existingUser) {
      console.error(`[API/Confirm] Utilizador não encontrado para o e-mail: ${email}`)
      return NextResponse.redirect(`${baseUrl}/auth/error?message=Utilizador não encontrado no sistema.`)
    }

    // 2. Se já estiver confirmado, redirecionamos para login indicando que já estava ativo
    if (existingUser.email_confirmed_at) {
      console.log(`[API/Confirm] Utilizador ${email} já se encontrava ativado. Redirecionando para login.`)
      return NextResponse.redirect(`${baseUrl}/auth/login?verified=already`)
    }

    // 3. Validar se o token de metadados bate com o token da URL
    const storedToken = existingUser.user_metadata?.verification_token
    if (!storedToken || storedToken !== token) {
      console.error(`[API/Confirm] Token de ativação inválido. Fornecido: ${token}, Armazenado: ${storedToken}`)
      return NextResponse.redirect(`${baseUrl}/auth/error?message=O link de ativação é inválido ou já expirou.`)
    }

    // 4. Confirmar o e-mail administrativamente no Supabase e limpar o token de metadados
    console.log(`[API/Confirm] Ativando conta administrativamente no Supabase para ID: ${existingUser.id}`)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
      email_confirm: true,
      user_metadata: {
        ...existingUser.user_metadata,
        verification_token: null
      }
    })

    if (updateError) {
      console.error('[API/Confirm] Falha crítica ao atualizar utilizador para verificado:', updateError)
      return NextResponse.redirect(`${baseUrl}/auth/error?message=Erro no sistema ao ativar a sua conta.`)
    }

    console.log(`[API/Confirm] Sucesso! Conta confirmada e ativa para: ${email}`)
    return NextResponse.redirect(`${baseUrl}/auth/login?verified=true`)

  } catch (error: any) {
    console.error('[API/Confirm] Erro inesperado no processamento de ativação:', error)
    return NextResponse.redirect(`${baseUrl}/auth/error?message=Erro crítico interno no servidor.`)
  }
}
