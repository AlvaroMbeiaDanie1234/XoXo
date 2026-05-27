-- Tabela para armazenar feedbacks dos utilizadores
CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

-- Política para permitir que utilizadores autenticados inseram seus próprios feedbacks
CREATE POLICY "Users can insert their own feedbacks"
ON feedbacks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política para permitir que utilizadores autenticados vejam seus próprios feedbacks
CREATE POLICY "Users can view their own feedbacks"
ON feedbacks
FOR SELECT
USING (auth.uid() = user_id);

-- Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id ON feedbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON feedbacks(created_at DESC);
