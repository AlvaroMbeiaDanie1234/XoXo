import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const connectionString = process.env.POSTGRES_URL;

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addFreePlanColumn() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    // Add is_free_plan column to profiles table
    await client.query(`
      ALTER TABLE profiles 
      ADD COLUMN IF NOT EXISTS is_free_plan BOOLEAN DEFAULT FALSE;
    `);
    console.log('Added is_free_plan column to profiles.');

  } catch (err) {
    console.error('Error executing query', err);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

addFreePlanColumn();
