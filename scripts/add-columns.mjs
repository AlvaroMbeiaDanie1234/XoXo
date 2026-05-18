import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL;

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addColumns() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    // Add phone column
    await client.query(`
      ALTER TABLE profiles 
      ADD COLUMN IF NOT EXISTS phone TEXT;
    `);
    console.log('Added phone column to profiles.');

    // Add SMS suspension & notifications columns
    await client.query(`
      ALTER TABLE profiles 
      ADD COLUMN IF NOT EXISTS sms_suspended_by_admin BOOLEAN DEFAULT FALSE;
    `);
    console.log('Added sms_suspended_by_admin column to profiles.');

    await client.query(`
      ALTER TABLE profiles 
      ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN DEFAULT TRUE;
    `);
    console.log('Added sms_notifications_enabled column to profiles.');

    // Add bio column
    await client.query(`
      ALTER TABLE profiles 
      ADD COLUMN IF NOT EXISTS bio TEXT;
    `);
    console.log('Added bio column to profiles.');

  } catch (err) {
    console.error('Error executing query', err);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

addColumns();
