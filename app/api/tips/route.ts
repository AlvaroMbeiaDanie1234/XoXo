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

    const { post_id, amount } = await request.json()

    if (!post_id || !amount) {
      return NextResponse.json({ error: 'post_id and amount are required' }, { status: 400 })
    }

    if (amount < 300) {
      return NextResponse.json({ error: 'Minimum tip amount is 300 AOA' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // Fetch post and creator info
    const { data: postData } = await supabaseAdmin
      .from('posts')
      .select('user_id, title, profiles(display_name)')
      .eq('id', post_id)
      .single()

    if (!postData) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (postData.user_id === user.id) {
      return NextResponse.json({ error: 'Cannot send tip to yourself' }, { status: 400 })
    }

    // Fetch sender's balance
    const { data: senderProfile } = await supabaseAdmin
      .from('profiles')
      .select('balance, display_name')
      .eq('id', user.id)
      .single()

    if (!senderProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (senderProfile.balance < amount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
    }

    // Fetch transaction fee from settings
    const { data: feeSetting } = await supabaseAdmin
      .from('system_settings')
      .select('*')
      .eq('key', 'transaction_fee_percent')
      .single()

    const feePercent = feeSetting ? Number(feeSetting.value) : 10
    const feeAmount = (amount * feePercent) / 100
    const creatorEarnings = amount - feeAmount

    // Deduct from sender's balance
    await supabaseAdmin
      .from('profiles')
      .update({ balance: senderProfile.balance - amount })
      .eq('id', user.id)

    // Add to creator's balance
    const { data: creatorProfile } = await supabaseAdmin
      .from('profiles')
      .select('balance')
      .eq('id', postData.user_id)
      .single()

    if (creatorProfile) {
      await supabaseAdmin
        .from('profiles')
        .update({ balance: creatorProfile.balance + creatorEarnings })
        .eq('id', postData.user_id)
    }

    // Record transaction for sender (tip)
    await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      amount: amount,
      type: 'tip',
      description: `Gorjeta enviada para ${postData.profiles?.display_name || 'criador'} pelo conteúdo "${postData.title}"`,
      status: 'completed'
    })

    // Record transaction for creator (earnings)
    await supabaseAdmin.from('transactions').insert({
      user_id: postData.user_id,
      amount: creatorEarnings,
      type: 'earnings',
      description: `Gorjeta recebida de ${senderProfile.display_name || user.email} pelo conteúdo "${postData.title}" (Comissão de ${feePercent}% deduzida)`,
      status: 'completed'
    })

    // Send notification to creator
    await supabaseAdmin.from('notifications').insert({
      user_id: postData.user_id,
      title: 'Gorjeta Recebida',
      message: `${senderProfile.display_name || user.email} enviou-te uma gorjeta de ${amount.toLocaleString()} AOA pelo conteúdo "${postData.title}"`,
      type: 'tip',
      is_read: false
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error sending tip:', error)
    return NextResponse.json({ error: 'Failed to send tip' }, { status: 500 })
  }
}
