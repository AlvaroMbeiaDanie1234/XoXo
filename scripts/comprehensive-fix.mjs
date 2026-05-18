import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function debugAndFix() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    // 1. Check profiles
    const profiles = await client.query('SELECT id, display_name FROM profiles');
    console.log('Profiles:', profiles.rows);

    // 2. Check posts and their URLs
    const posts = await client.query('SELECT id, title, content_url, content_type FROM posts');
    console.log('Posts:', posts.rows);

    // 3. Fix likes table RLS and schema cache
    // Drop and recreate likes table to be 100% sure of structure
    await client.query(`
      DROP TABLE IF EXISTS likes;
      CREATE TABLE likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, post_id)
      );
      ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Allow public read" ON likes FOR SELECT USING (true);
      CREATE POLICY "Allow auth insert" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
      CREATE POLICY "Allow auth delete" ON likes FOR DELETE USING (auth.uid() = user_id);
      GRANT ALL ON likes TO authenticated;
      GRANT ALL ON likes TO anon;
      GRANT ALL ON likes TO service_role;
    `);
    console.log('Likes table recreated with RLS policies.');

    // 4. Fix media bucket policies again
    await client.query(`
      INSERT INTO storage.buckets (id, name, public) 
      VALUES ('media', 'media', true) 
      ON CONFLICT (id) DO UPDATE SET public = true;

      -- Ensure policies exist for media bucket
      DELETE FROM storage.policies WHERE bucket_id = 'media';
      INSERT INTO storage.policies (name, bucket_id, definition, action, role) VALUES 
      ('Public Access', 'media', '(bucket_id = ''media''::text)', 'SELECT', 'public'),
      ('Auth Insert', 'media', '(bucket_id = ''media''::text)', 'INSERT', 'authenticated');
    `);
    console.log('Storage policies refreshed.');

    // 5. Final Notification
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log('Schema reload notified.');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

debugAndFix();
