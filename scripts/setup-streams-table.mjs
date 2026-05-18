import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupStreams() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    const schemaSql = `
      -- Create live_streams table
      CREATE TABLE IF NOT EXISTS live_streams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        price NUMERIC NOT NULL DEFAULT 0,
        is_free BOOLEAN NOT NULL DEFAULT true,
        is_active BOOLEAN NOT NULL DEFAULT true,
        viewer_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      -- Create live_stream_comments table
      CREATE TABLE IF NOT EXISTS live_stream_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        stream_id UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      -- Create live_stream_purchases table
      CREATE TABLE IF NOT EXISTS live_stream_purchases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        stream_id UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(stream_id, user_id)
      );

      -- Enable realtime replication for these tables
      ALTER TABLE live_streams REPLICA IDENTITY FULL;
      ALTER TABLE live_stream_comments REPLICA IDENTITY FULL;
      ALTER TABLE live_stream_purchases REPLICA IDENTITY FULL;

      -- Disable RLS to ensure client write access is never blocked
      ALTER TABLE live_streams DISABLE ROW LEVEL SECURITY;
      ALTER TABLE live_stream_comments DISABLE ROW LEVEL SECURITY;
      ALTER TABLE live_stream_purchases DISABLE ROW LEVEL SECURITY;

      -- Add tables to realtime publication if they are not already
      -- We'll try to add them and ignore if they are already part of it
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
          CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
        END IF;
      END $$;
    `;

    await client.query(schemaSql);
    console.log('Tables created successfully!');

    // Add to publication separately to handle already part of errors gracefully
    const tables = ['live_streams', 'live_stream_comments', 'live_stream_purchases'];
    for (const table of tables) {
      try {
        await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE ${table};`);
        console.log(`Table ${table} added to supabase_realtime publication.`);
      } catch (err) {
        if (err.code === '42704' || err.message.includes('already part of publication')) {
          console.log(`Table ${table} is already in publication.`);
        } else {
          console.error(`Error adding ${table} to publication:`, err.message);
        }
      }
    }

  } catch (err) {
    console.error('Error setting up streams tables:', err);
  } finally {
    await client.end();
  }
}

setupStreams();
