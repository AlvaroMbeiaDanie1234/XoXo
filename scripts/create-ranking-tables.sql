-- Tabela para armazenar o histórico de rankings
CREATE TABLE IF NOT EXISTS ranking_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  subscriber_count INTEGER NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_ranking_history_creator_id ON ranking_history(creator_id);
CREATE INDEX IF NOT EXISTS idx_ranking_history_recorded_at ON ranking_history(recorded_at DESC);

-- Tabela para notificações de ranking
CREATE TABLE IF NOT EXISTS ranking_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'rank_up', 'rank_down', 'top_1'
  old_rank INTEGER,
  new_rank INTEGER NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_ranking_notifications_user_id ON ranking_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_ranking_notifications_read ON ranking_notifications(read);
