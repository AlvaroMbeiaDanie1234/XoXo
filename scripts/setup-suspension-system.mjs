import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupSuspensionSystem() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    // Add suspended column
    await client.query(`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT FALSE;
    `);
    console.log('Added "suspended" column to profiles.');

    // Add suspension_reason column
    await client.query(`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
    `);
    console.log('Added "suspension_reason" column to profiles.');

    // Add suspended_at column
    await client.query(`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
    `);
    console.log('Added "suspended_at" column to profiles.');

    console.log('Suspension system setup complete!');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

setupSuspensionSystem();
