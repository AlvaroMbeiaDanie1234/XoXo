ROdar directamente no supabase em editor


CREATE TABLE post_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_post_views_unique ON post_views(post_id, user_id);
CREATE INDEX idx_post_views_post_id ON post_views(post_id);
CREATE INDEX idx_post_views_user_id ON post_views(user_id);

ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view post views" ON post_views FOR SELECT USING (true);
CREATE POLICY "Users can insert their own views" ON post_views FOR INSERT WITH CHECK (auth.uid() = user_id);