import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function addMessageFileColumns() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    // Add file_url, file_name, and file_type columns to messages table
    await client.query(`
      ALTER TABLE messages 
      ADD COLUMN IF NOT EXISTS file_url TEXT,
      ADD COLUMN IF NOT EXISTS file_name TEXT,
      ADD COLUMN IF NOT EXISTS file_type TEXT;
    `);

    console.log('File columns added to messages table successfully.');
    await client.query("NOTIFY pgrst, 'reload schema';");

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

addMessageFileColumns();
