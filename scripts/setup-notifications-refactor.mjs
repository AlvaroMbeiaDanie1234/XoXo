import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function setup() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    await client.query(`
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES posts(id) ON DELETE CASCADE;
    `);
    console.log('✓ post_id column added');

    await client.query(`
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES comments(id) ON DELETE CASCADE;
    `);
    console.log('✓ comment_id column added');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_post_id ON notifications(post_id);
    `);
    console.log('✓ notifications post_id index created');

    console.log('Notifications refactor setup complete!');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setup();
