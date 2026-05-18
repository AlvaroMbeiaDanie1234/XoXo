import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixStorage() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    // 1. Ensure bucket is public
    await client.query("UPDATE storage.buckets SET public = true WHERE id = 'media'");
    
    // 2. Drop existing policies on storage.objects for 'media'
    await client.query(`
      DROP POLICY IF EXISTS "Public Access" ON storage.objects;
      DROP POLICY IF EXISTS "Auth Insert" ON storage.objects;
      DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
      DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;
    `);

    // 3. Create new policies
    await client.query(`
      CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'media');
      CREATE POLICY "Auth Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');
      CREATE POLICY "Auth Update" ON storage.objects FOR UPDATE USING (bucket_id = 'media' AND auth.uid() = owner);
      CREATE POLICY "Auth Delete" ON storage.objects FOR DELETE USING (bucket_id = 'media' AND auth.uid() = owner);
    `);
    
    console.log('Storage policies recreated successfully.');

    // 4. Force schema reload for PostgREST
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log('Schema reload notified.');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

fixStorage();
