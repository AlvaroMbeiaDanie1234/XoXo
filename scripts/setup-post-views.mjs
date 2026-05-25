import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Use admin client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupPostViews() {
  try {
    console.log('Creating post_views table...');

    // Try to create table using Supabase Management API
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/post_views`, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        post_id: '00000000-0000-0000-0000-000000000000',
        user_id: '00000000-0000-0000-0000-000000000000'
      })
    });

    if (response.ok) {
      console.log('Table post_views already exists.');
    } else {
      const error = await response.json();
      console.log('Table does not exist. Please run this SQL manually in Supabase SQL Editor:');
      console.log(`
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
      `);
    }

  } catch (err) {
    console.error('Error setting up post_views:', err);
  }
}

setupPostViews();
