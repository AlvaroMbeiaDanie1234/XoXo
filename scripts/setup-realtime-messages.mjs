import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupRealtimeMessages() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    // Enable realtime for the messages table
    const enableRealtimeSql = `
      -- Check if publication exists, otherwise create it
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
          CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
        END IF;
      END $$;

      -- Make sure messages table has replica identity
      ALTER TABLE messages REPLICA IDENTITY FULL;

      -- Add messages to realtime publication if it's not already
      ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    `;
    
    // Some of these might fail if it's already in the publication, so we wrap the ADD TABLE part in a try-catch or we just ignore the error.
    try {
      await client.query(enableRealtimeSql);
      console.log('Realtime enabled for messages table.');
    } catch (err) {
      if (err.code === '42704' || err.message.includes('already part of publication')) {
        console.log('Table messages is already in supabase_realtime publication.');
      } else {
        throw err;
      }
    }

  } catch (err) {
    console.error('Error setting up realtime:', err);
  } finally {
    await client.end();
  }
}

setupRealtimeMessages();
