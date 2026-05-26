-- Create live_messages table
CREATE TABLE IF NOT EXISTS live_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id UUID NOT NULL REFERENCES lives(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  username VARCHAR(255),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_live_messages_live_id ON live_messages(live_id);
CREATE INDEX IF NOT EXISTS idx_live_messages_created_at ON live_messages(created_at);

-- Enable RLS
ALTER TABLE live_messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view live messages" ON live_messages FOR SELECT USING (true);
CREATE POLICY "Users can create live messages" ON live_messages FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);
