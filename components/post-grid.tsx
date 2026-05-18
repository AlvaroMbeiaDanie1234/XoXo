import PostCard from './post-card'

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

interface PostGridProps {
  posts: Post[]
}

export default function PostGrid({ posts }: PostGridProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-lg">Nenhum conteúdo disponível</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
