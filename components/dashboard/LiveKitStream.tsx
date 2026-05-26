'use client'

import { useEffect, useRef, useState } from 'react'
import { Room, RoomEvent, RemoteTrack, TrackPublication, Participant, createLocalTracks, LocalTrack } from 'livekit-client'

interface LiveKitStreamProps {
  roomName: string
  participantName: string
  isHost: boolean
  token: string
  onLeave?: () => void
}

export default function LiveKitStream({
  roomName,
  participantName,
  isHost,
  token,
  onLeave
}: LiveKitStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const roomRef = useRef<Room | null>(null)

  useEffect(() => {
    async function connectToRoom() {
      try {
        const room = new Room()
        roomRef.current = room

        room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: TrackPublication, participant: Participant) => {
          if (track.kind === 'video' && videoRef.current) {
            const videoElement = videoRef.current
            track.attach(videoElement)
            videoElement.play().catch(console.error)
          }
        })

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach()
        })

        room.on(RoomEvent.Disconnected, () => {
          setIsConnected(false)
          if (onLeave) onLeave()
        })

        await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL || '', token)
        
        if (isHost) {
          const tracks = await createLocalTracks({ audio: true, video: true })
          await room.localParticipant.publishTrack(tracks[1]) // Video track
          await room.localParticipant.publishTrack(tracks[0]) // Audio track
        }
        
        setIsConnected(true)
      } catch (err: any) {
        setError(err.message || 'Erro ao conectar ao LiveKit')
        console.error('LiveKit connection error:', err)
      }
    }

    connectToRoom()

    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect()
      }
    }
  }, [roomName, token, onLeave, isHost])

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50">
        <p className="text-red-600">Erro: {error}</p>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isHost}
        className="w-full h-full object-contain"
      />
      {isHost && (
        <button
          onClick={() => {
            if (roomRef.current) {
              roomRef.current.disconnect()
              if (onLeave) onLeave()
            }
          }}
          className="absolute bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg"
        >
          Encerrar
        </button>
      )}
    </div>
  )
}
