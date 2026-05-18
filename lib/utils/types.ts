export type ContentType = 'video' | 'article' | 'photo'

export interface Profile {
  id: string
  display_name: string
  avatar_url?: string
  bio?: string
  created_at: string
  updated_at: string
}

export interface Post {
  id: string
  user_id: string
  title: string
  description?: string
  content_type: ContentType
  content_url: string
  thumbnail_url?: string
  created_at: string
  updated_at: string
  profiles?: Profile
  favorites?: Array<{ id: string }>
  comments?: Array<{ id: string }>
}

export interface Comment {
  id: string
  user_id: string
  post_id: string
  content: string
  created_at: string
  updated_at: string
  profiles?: Profile
}

export interface Favorite {
  id: string
  user_id: string
  post_id: string
  created_at: string
}
