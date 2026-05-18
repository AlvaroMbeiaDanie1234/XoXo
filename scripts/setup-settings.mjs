import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupSettings() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    // Create system_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      INSERT INTO system_settings (key, value) 
      VALUES ('linkpaga_slug', 'osegredo-1778917788644')
      ON CONFLICT (key) DO NOTHING;
    `);

    console.log('System settings table created.');
    await client.query("NOTIFY pgrst, 'reload schema';");

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

setupSettings();
