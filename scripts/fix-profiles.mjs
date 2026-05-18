import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixProfileTable() {
  try {
    await client.connect();
    
    // Add email column if it doesn't exist
    await client.query('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;');
    console.log('Column "email" checked/added to profiles.');

    // List profiles to debug
    const res = await client.query('SELECT id, display_name FROM profiles');
    console.log('Profiles currently in DB:');
    console.table(res.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

fixProfileTable();
