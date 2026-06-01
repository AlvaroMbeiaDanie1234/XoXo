'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Radio } from 'lucide-react'

interface ZegoStreamProps {
  roomID: string
  userID: string
  userName: string
  isHost: boolean
  onLeave?: () => void
}

export default function ZegoStream({
  roomID,
  userID,
  userName,
  isHost,
  onLeave
}: ZegoStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const zpRef = useRef<any>(null)
  const [live, setLive] = useState(!isHost)

  useEffect(() => {
    if (!live) return
    let active = true

    const initZego = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()

        let appID = Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID)
        let serverSecret = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET

        try {
          const { data: dbSettings } = await supabase
            .from('system_settings')
            .select('*')
            .in('key', ['NEXT_PUBLIC_ZEGO_APP_ID', 'NEXT_PUBLIC_ZEGO_SERVER_SECRET'])

          if (dbSettings) {
            const dbAppId = dbSettings.find(s => s.key === 'NEXT_PUBLIC_ZEGO_APP_ID')?.value
            const dbSecret = dbSettings.find(s => s.key === 'NEXT_PUBLIC_ZEGO_SERVER_SECRET')?.value

            if (dbAppId) appID = Number(dbAppId)
            if (dbSecret) serverSecret = dbSecret
          }
        } catch (dbErr) {
          console.warn('Could not load Zego settings from database, using env fallback:', dbErr)
        }

        if (!appID || isNaN(appID)) {
          throw new Error('NEXT_PUBLIC_ZEGO_APP_ID is missing or invalid')
        }
        if (!serverSecret) {
          throw new Error('NEXT_PUBLIC_ZEGO_SERVER_SECRET is missing')
        }

        const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt')

        if (!active) return

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID,
          serverSecret,
          roomID,
          userID,
          userName || `User_${userID.slice(0, 4)}`
        )

        const zp = ZegoUIKitPrebuilt.create(kitToken)
        zpRef.current = zp

        zp.joinRoom({
          container: containerRef.current!,
          scenario: {
            mode: ZegoUIKitPrebuilt.LiveStreaming,
            config: {
              role: isHost ? ZegoUIKitPrebuilt.Host : ZegoUIKitPrebuilt.Audience,
            },
          },
          showPreJoinView: false,
          showScreenSharingButton: isHost,
          showUserList: false,
          turnOnCameraWhenJoining: isHost,
          turnOnMicrophoneWhenJoining: isHost,
          showMyCameraToggleButton: isHost,
          showMyMicrophoneToggleButton: isHost,
          showAudioVideoSettingsButton: isHost,
          showTextChat: false,
          lowerLeftNotification: {
            showUserJoinAndLeave: false,
            showTextChat: false,
          },
          layout: 'Auto',
          showLeavingView: false,
          showRoomInfo: false,
          showDuration: false,
          showNonHostUserList: false,
          showNonHostUserAvatar: false,
          onLeaveRoom: () => {
            if (onLeave) onLeave()
          }
        } as any)
      } catch (err: any) {
        console.error('ZEGOCLOUD initialization error:', err)
        if (active) {
          setError(err.message || 'Failed to initialize video streaming.')
        }
      }
    }

    initZego()

    return () => {
      active = false
      if (zpRef.current) {
        try {
          if (typeof zpRef.current.destroy === 'function') {
            zpRef.current.destroy()
          }
        } catch (e) {
          console.error('Error destroying Zego instance:', e)
        }
      }
    }
  }, [live, roomID, userID, userName, isHost])

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 text-white p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h4 className="text-lg font-black tracking-tight mb-2">Erro de Conectividade</h4>
        <p className="text-xs text-zinc-400 max-w-xs mb-4">{error}</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-black relative" style={{ minHeight: '400px' }}>
      {isHost && !live && (
        <button
          onClick={() => setLive(true)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-50 bg-gradient-to-b from-accent to-purple-600 text-white font-black text-[11px] uppercase tracking-widest px-2.5 py-6 rounded-r-xl shadow-2xl hover:from-accent/90 hover:to-purple-600/90 transition-all flex flex-col items-center gap-1.5 pointer-events-auto border-l-0 border-2 border-l-0 border-accent/30"
          style={{ writingMode: 'vertical-lr', textOrientation: 'mixed' }}
        >
          <Radio size={16} className="animate-pulse" />
          <span>GO LIVE</span>
        </button>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
