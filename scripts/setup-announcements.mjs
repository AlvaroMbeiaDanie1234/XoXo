import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupAnnouncements() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    // Create system_announcements table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_announcements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(20) NOT NULL, -- 'comunicado', 'anuncio'
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        target_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- NULL means all users
        image_url TEXT, -- for ads / announcements
        link_url TEXT, -- for ads
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('System announcements table created successfully.');
    await client.query("NOTIFY pgrst, 'reload schema';");

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

setupAnnouncements();
