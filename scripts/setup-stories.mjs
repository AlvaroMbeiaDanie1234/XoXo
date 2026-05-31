import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupStories() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    await client.query(`
      CREATE TABLE IF NOT EXISTS stories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        media_url TEXT,
        content TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
      );
    `);
    console.log('✓ stories table created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
    `);
    console.log('✓ stories indexes created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);
    `);
    console.log('✓ stories expires_at index created');

    console.log('Stories setup complete!');
  } catch (err) {
    console.error('Error setting up stories:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupStories();
