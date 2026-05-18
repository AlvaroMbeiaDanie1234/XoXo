import { NextResponse } from 'next/server'
import { sendSMS } from '@/lib/telcosms'

export async function POST(req: Request) {
  try {
    const { userId, body } = await req.json()

    if (!userId || !body) {
      return NextResponse.json({ error: 'Missing userId or body' }, { status: 400 })
    }

    const result = await sendSMS({ userId, body })
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[SMS Route Error]:', err)
    return NextResponse.json({ error: err.message || 'SMS send failed' }, { status: 500 })
  }
}
