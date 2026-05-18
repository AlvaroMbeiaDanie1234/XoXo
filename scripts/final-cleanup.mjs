import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function finalCleanup() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    // 1. Delete all posts to avoid broken media links from previous attempts
    await client.query('DELETE FROM posts;');
    console.log('All posts deleted. Ready for fresh test.');

    // 2. Ensure bucket is public and policies are active
    await client.query("UPDATE storage.buckets SET public = true WHERE id = 'media';");
    
    // 3. Force schema reload correctly
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log('Bucket updated and schema reload notified.');

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

finalCleanup();
