-- Create lives table
CREATE TABLE IF NOT EXISTS lives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  is_paid BOOLEAN DEFAULT false,
  price DECIMAL(10, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'ended', -- 'live', 'ended'
  stream_url TEXT,
  thumbnail_url TEXT,
  viewer_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_lives_creator_id ON lives(creator_id);
CREATE INDEX IF NOT EXISTS idx_lives_status ON lives(status);

-- Enable RLS
ALTER TABLE lives ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all lives" ON lives FOR SELECT USING (true);
CREATE POLICY "Users can create their own lives" ON lives FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update their own lives" ON lives FOR UPDATE USING (auth.uid() = creator_id);
