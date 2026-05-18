import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupComments() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    // 1. Ensure column parent_id exists
    await client.query(`
      ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;
    `);

    // 2. Add indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
      CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
    `);

    console.log('Comments table updated with parent_id and indexes.');
    await client.query("NOTIFY pgrst, 'reload schema';");

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

setupComments();
