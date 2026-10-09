-- ==============================================================================
-- Otimização de Performance: Índices Estratégicos para Consultas e Listagens Rápidas
-- ==============================================================================

-- 1. Otimização de Feed de Publicações (Ordenação por data e filtro de criador)
CREATE INDEX IF NOT EXISTS idx_posts_created_at_desc ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON public.posts (user_id, created_at DESC);

-- 2. Otimização de Curtidas (Contagens por post e verificação de curtida do utilizador)
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON public.likes (post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_post ON public.likes (user_id, post_id);

-- 3. Otimização de Comentários (Contagens e listagem por post)
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON public.comments (post_id, created_at DESC);

-- 4. Otimização de Visualizações de Posts
CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON public.post_views (post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_user_post ON public.post_views (user_id, post_id);

-- 5. Otimização de Compras e Paywall (Verificação rápida se o usuário comprou o post)
CREATE INDEX IF NOT EXISTS idx_purchases_user_post ON public.purchases (user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user_status ON public.purchases (user_id, status);

-- 6. Otimização de Seguidores e Assinaturas (Contagem rápida de seguidores)
CREATE INDEX IF NOT EXISTS idx_subscriptions_following_id ON public.subscriptions (following_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_follower_following ON public.subscriptions (follower_id, following_id);

-- 7. Otimização de Mensagens Não Lidas (Sidebar badge instantâneo)
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON public.messages (receiver_id, is_read);

-- 8. Otimização de Histórias Ativas
CREATE INDEX IF NOT EXISTS idx_stories_expires_created ON public.stories (expires_at, created_at DESC);

-- Atualiza estatísticas do planejador do PostgreSQL
ANALYZE public.posts;
ANALYZE public.likes;
ANALYZE public.comments;
ANALYZE public.post_views;
ANALYZE public.purchases;
ANALYZE public.subscriptions;
ANALYZE public.messages;
ANALYZE public.stories;
ANALYZE public.profiles;
