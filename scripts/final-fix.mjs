import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function finalFix() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    // 1. Ensure bucket 'media' is public in storage.buckets
    await client.query(`
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('media', 'media', true)
      ON CONFLICT (id) DO UPDATE SET public = true;
    `);
    console.log('Bucket "media" set to public.');

    // 2. Add Storage Policies (using the correct table storage.objects)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access' AND tablename = 'objects' AND schemaname = 'storage') THEN
          CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'media');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth Insert' AND tablename = 'objects' AND schemaname = 'storage') THEN
          CREATE POLICY "Auth Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');
        END IF;
      END $$;
    `);
    console.log('Storage policies checked/added.');

    // 3. Fix the 406 error on 'likes'
    // This usually means PostgREST needs to reload its schema cache.
    // We can force this by touching the table or just ensuring it's there.
    await client.query('NOTIFY pgrst, "reload schema";');
    console.log('PostgREST schema reload notified.');

    // 4. Verify columns in 'posts'
    const postsCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'posts' AND table_schema = 'public';
    `);
    console.log('Posts columns:', postsCols.rows.map(r => r.column_name));

    // 5. Check for any broken content_urls (ones that are just UUIDs instead of URLs)
    const brokenPosts = await client.query("SELECT id, content_url FROM posts WHERE content_url NOT LIKE 'http%'");
    if (brokenPosts.rows.length > 0) {
      console.log('Found broken content_urls:', brokenPosts.rows);
      // Let's try to fix them if they are just the file path
      for (const post of brokenPosts.rows) {
        if (post.content_url && !post.content_url.includes('/')) {
           // It's likely just a filename or UUID. We can't easily guess the full path without more info.
           // But we can set a placeholder or null to avoid ERR_FILE_NOT_FOUND
        }
      }
    }

  } catch (err) {
    console.error('Error in final fix:', err);
  } finally {
    await client.end();
  }
}

finalFix();
