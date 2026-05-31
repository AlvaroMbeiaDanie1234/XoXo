import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupStoryViews() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    await client.query(`
      CREATE TABLE IF NOT EXISTS story_views (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(story_id, user_id)
      );
    `);
    console.log('✓ story_views table created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_story_views_story_id ON story_views(story_id);
    `);
    console.log('✓ story_views index created');

    console.log('Story views setup complete!');
  } catch (err) {
    console.error('Error setting up story views:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupStoryViews();
