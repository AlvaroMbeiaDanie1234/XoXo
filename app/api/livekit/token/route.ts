import { NextRequest, NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'

export async function POST(request: NextRequest) {
  try {
    const { roomName, participantName, isHost } = await request.json()

    if (!roomName || !participantName) {
      return NextResponse.json(
        { error: 'roomName e participantName são obrigatórios' },
        { status: 400 }
      )
    }

    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Credenciais do LiveKit não configuradas' },
        { status: 500 }
      )
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName,
    })

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: isHost || false,
      canSubscribe: true,
    })

    const token = at.toJwt()
    return NextResponse.json({ token })
  } catch (error) {
    console.error('Erro ao gerar token do LiveKit:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar token do LiveKit' },
      { status: 500 }
    )
  }
}
