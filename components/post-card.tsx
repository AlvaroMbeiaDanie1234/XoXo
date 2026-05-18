'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

interface Post {
  id: string
  title: string
  description: string
  content_type: string
  content_url: string
  thumbnail_url: string
  created_at: string
  user_id: string
  profiles?: {
    display_name: string
    avatar_url: string | null
  }
}

interface PostCardProps {
  post: Post
}

const contentTypeIcons: Record<string, string> = {
  video: '▶',
  article: '📄',
  photo: '🖼',
}

const contentTypeLabels: Record<string, string> = {
  video: 'Vídeo',
  article: 'Artigo',
  photo: 'Foto',
}

export default function PostCard({ post }: PostCardProps) {
  const [imageError, setImageError] = useState(false)

  return (
    <Link href={`/dashboard/post/${post.id}`}>
      <div className="group cursor-pointer h-full">
        <div className="relative aspect-video rounded-lg overflow-hidden bg-muted mb-3">
          {/* Thumbnail */}
          {post.thumbnail_url && !imageError ? (
            <Image
              src={post.thumbnail_url}
              alt={post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
              <span className="text-4xl">{contentTypeIcons[post.content_type] || '📌'}</span>
            </div>
          )}

          {/* Content Type Badge */}
          <div className="absolute top-2 right-2 bg-black/70 text-white px-2.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5">
            <span>{contentTypeIcons[post.content_type]}</span>
            <span>{contentTypeLabels[post.content_type]}</span>
          </div>

          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
                <span className="text-white text-xl">→</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-accent transition-colors text-sm">
            {post.title}
          </h3>

          {post.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {post.description}
            </p>
          )}

          {/* Author Info */}
          {post.profiles && (
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              {post.profiles.avatar_url ? (
                <Image
                  src={post.profiles.avatar_url}
                  alt={post.profiles.display_name}
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-white text-xs">
                  {post.profiles.display_name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs text-muted-foreground truncate">
                {post.profiles.display_name}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
