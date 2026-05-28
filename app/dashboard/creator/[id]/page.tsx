import { createClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/header'
import Sidebar from '@/components/dashboard/sidebar'
import PostCard from '@/components/dashboard/post-card'
import { Users, PlaySquare } from 'lucide-react'
import CreatorProfileActions from '@/components/dashboard/creator-profile-actions'
import ProfilePhotoModal from '@/components/dashboard/profile-photo-modal'

export default async function CreatorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch logged-in user
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch creator profile
  const { data: creator, error: creatorError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  // Fetch creator posts
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('*, profiles(display_name, avatar_url)')
    .eq('user_id', id)
    .order('created_at', { ascending: false })

  // Fetch subscriber count
  const { count: subscriberCount } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', id)

  if (creatorError || !creator) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} />
        <div className="max-w-[1128px] mx-auto pt-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">Criador não encontrado</h1>
        </div>
      </div>
    )
  }

  const postCount = posts?.length || 0

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />

      <div className="max-w-[1128px] mx-auto flex justify-center gap-6 pt-4 px-4 sm:pt-6">
        {/* Left Sidebar */}
        <div className="hidden lg:block w-[225px] flex-shrink-0">
          <Sidebar />
        </div>

        {/* Main Content */}
        <div className="flex-1 max-w-[800px] w-full">
          {/* Futuristic Profile Header */}
          <div className="relative mb-6 overflow-hidden border-y border-border bg-white shadow-sm sm:rounded-xl sm:border dark:border-gray-800 dark:bg-gray-950">
            {/* Cover Banner */}
            <div className="relative h-40 w-full overflow-hidden bg-[linear-gradient(135deg,#111827_0%,#e31e24_48%,#111111_100%)] sm:h-48">
              <div className="absolute inset-0 bg-black/15" />
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30 mix-blend-overlay" />
            </div>

            {/* Profile Info Section */}
            <div className="relative px-4 pb-6 sm:px-8 sm:pb-8">
              <div className="-mt-14 flex flex-col gap-4 sm:-mt-16">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  {/* Avatar */}
                  {creator.avatar_url ? (
                    <ProfilePhotoModal avatarUrl={creator.avatar_url} displayName={creator.display_name} />
                  ) : (
                    <div className="z-20 w-fit rounded-full bg-white p-1.5 shadow-2xl shadow-black/20 dark:bg-gray-950">
                      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-tr from-accent to-primary text-3xl font-bold text-white shadow-inner sm:h-28 sm:w-28 sm:text-4xl dark:border-gray-950">
                        {creator.display_name ? creator.display_name.charAt(0).toUpperCase() : 'U'}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="z-10 w-full sm:w-auto sm:pb-2">
                    <CreatorProfileActions creatorId={id} currentUserId={user?.id} />
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="mt-5 sm:mt-6">
                <h1 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2 sm:text-3xl">
                  {creator.display_name || 'Usuário'}
                </h1>

                {creator.phone && (
                  <p className="text-sm font-medium text-muted-foreground mt-1 flex items-center gap-1.5">
                    <span className="text-accent">📞</span> {creator.phone}
                  </p>
                )}

                <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {creator.bio ? creator.bio : 'Bem-vindo ao meu espaçXoXo. Aqui partilho os meus melhores conteúdos, tutoriais avançados e bastidores que não vais encontrar em mais lado nenhum. Subscreve para acederes a tudo!'}
                </p>
              </div>

              {/* Stats */}
              <div className="mt-6 grid grid-cols-2 gap-3 border-y border-border/50 py-4 sm:mt-8 sm:flex sm:items-center sm:gap-8 dark:border-gray-800">
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-foreground">{postCount}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1">
                    <PlaySquare size={14} /> Conteúdos
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-foreground">{subscriberCount || 0}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Users size={14} /> Subscritores
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Posts Feed */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-4 pl-2 border-l-4 border-accent">
              Conteúdos de {creator.display_name || 'Usuário'}
            </h2>

            {!posts || posts.length === 0 ? (
              <div className="rounded-xl border border-border bg-white p-12 text-center shadow-sm dark:border-gray-800 dark:bg-gray-950">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-gray-900">
                  <PlaySquare size={24} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Ainda não há publicações</h3>
                <p className="text-muted-foreground">Este criador ainda não partilhou nenhum conteúdXoXo.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 w-full max-w-[560px] mx-auto">
                {posts.map((post: any) => (
                  <PostCard
                    key={post.id}
                    id={post.id}
                    title={post.title}
                    description={post.description}
                    thumbnail_url={post.thumbnail_url}
                    content_url={post.content_url}
                    content_type={post.content_type}
                    creator_name={post.profiles?.display_name || 'Usuário'}
                    creator_avatar={post.profiles?.avatar_url || undefined}
                    creator_verified={post.profiles?.is_verified || false}
                    creator_id={post.user_id}
                    price={post.price}
                    is_free={post.is_free}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
