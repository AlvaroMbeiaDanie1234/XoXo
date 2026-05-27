import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Buscar todos os criadores com contagem de seguidores
    const { data: creators } = await supabase
      .from('profiles')
      .select('id, display_name')
      .order('subscriber_count', { ascending: false })

    if (!creators) {
      return NextResponse.json({ success: true, message: 'No creators found' })
    }

    // Buscar contagem de seguidores para cada criador
    const creatorsWithCounts = await Promise.all(
      creators.map(async (creator) => {
        const { count } = await supabase
          .from('subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('following_id', creator.id)

        return {
          ...creator,
          subscriber_count: count || 0
        }
      })
    )

    // Ordenar por número de seguidores
    const sortedCreators = creatorsWithCounts.sort((a, b) => b.subscriber_count - a.subscriber_count)

    // Buscar o último ranking registrado
    const { data: lastRanking } = await supabase
      .from('ranking_history')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(100)

    // Criar mapa do último ranking
    const lastRankingMap = new Map()
    if (lastRanking) {
      lastRanking.forEach((record) => {
        lastRankingMap.set(record.creator_id, record.rank)
      })
    }

    // Detectar mudanças e criar notificações
    const notifications = []
    const now = new Date()

    for (let i = 0; i < sortedCreators.length; i++) {
      const creator = sortedCreators[i]
      const currentRank = i + 1
      const lastRank = lastRankingMap.get(creator.id)

      // Se é o primeiro lugar e não estava no topo antes
      if (currentRank === 1 && lastRank !== 1) {
        notifications.push({
          user_id: creator.id,
          type: 'top_1',
          old_rank: lastRank,
          new_rank: currentRank,
          message: `🎉 Parabéns! Você está liderando o Placar FAMA XOXO! Continue assim!`
        })
      }
      // Se subiu de ranking
      else if (lastRank && currentRank < lastRank) {
        notifications.push({
          user_id: creator.id,
          type: 'rank_up',
          old_rank: lastRank,
          new_rank: currentRank,
          message: `📈 Você subiu no ranking! De #${lastRank} para #${currentRank}`
        })
      }
      // Se desceu de ranking
      else if (lastRank && currentRank > lastRank) {
        notifications.push({
          user_id: creator.id,
          type: 'rank_down',
          old_rank: lastRank,
          new_rank: currentRank,
          message: `📉 Você desceu no ranking. De #${lastRank} para #${currentRank}. Continue se esforçando!`
        })
      }

      // Salvar no histórico
      await supabase.from('ranking_history').insert({
        creator_id: creator.id,
        rank: currentRank,
        subscriber_count: creator.subscriber_count,
        recorded_at: now
      })
    }

    // Inserir notificações
    if (notifications.length > 0) {
      await supabase.from('ranking_notifications').insert(notifications)
    }

    return NextResponse.json({
      success: true,
      message: 'Ranking checked and notifications sent',
      changes: notifications.length
    })
  } catch (error) {
    console.error('Error checking ranking changes:', error)
    return NextResponse.json({ success: false, error: 'Failed to check ranking changes' }, { status: 500 })
  }
}
