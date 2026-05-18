import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function addForeignKey() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    // Add foreign key constraint
    // We assume profiles.id is the primary key and posts.user_id is the column to link
    await client.query(`
      ALTER TABLE posts
      DROP CONSTRAINT IF EXISTS posts_user_id_fkey,
      ADD CONSTRAINT posts_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES profiles(id)
      ON DELETE CASCADE;
    `);
    console.log('Added foreign key constraint: posts(user_id) -> profiles(id)');

  } catch (err) {
    console.error('Error adding foreign key:', err);
  } finally {
    await client.end();
  }
}

addForeignKey();
