import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupMonetization() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    // 1. Add price and is_free to posts
    await client.query(`
      ALTER TABLE posts 
      ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT TRUE;
    `);
    console.log('Updated posts table with price and is_free.');

    // 2. Create purchases table
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        status TEXT DEFAULT 'completed', -- pending, completed
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, post_id)
      );
    `);
    console.log('Table "purchases" ready.');

    // 3. Add balance to profiles
    await client.query(`
      ALTER TABLE profiles 
      ADD COLUMN IF NOT EXISTS balance DECIMAL(10, 2) DEFAULT 0;
    `);
    console.log('Added "balance" to profiles.');

    // 4. Favorites Table (if not exists)
    await client.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, post_id)
      );
    `);
    console.log('Table "favorites" ready.');

  } catch (err) {
    console.error('Error setting up monetization:', err);
  } finally {
    await client.end();
  }
}

setupMonetization();
