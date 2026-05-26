import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupSubscriptions() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    // Create subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(follower_id, following_id)
      );
    `);
    console.log('Table "subscriptions" created.');

    // Add indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_subscriptions_follower_id ON subscriptions(follower_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_following_id ON subscriptions(following_id);
    `);
    console.log('Indexes created.');

    // Enable RLS
    await client.query(`
      ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
    `);
    console.log('RLS enabled.');

    // Create policies
    await client.query(`
      CREATE POLICY "Users can view subscriptions" ON subscriptions FOR SELECT USING (true);
      CREATE POLICY "Users can insert their own subscriptions" ON subscriptions FOR INSERT WITH CHECK (auth.uid() = follower_id);
      CREATE POLICY "Users can delete their own subscriptions" ON subscriptions FOR DELETE USING (auth.uid() = follower_id);
    `);
    console.log('Policies created.');

    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log('Schema reloaded.');

  } catch (err) {
    console.error('Error setting up subscriptions:', err);
  } finally {
    await client.end();
  }
}

setupSubscriptions();
