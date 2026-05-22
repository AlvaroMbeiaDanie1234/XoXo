import { Client } from 'pg';
import * as dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function setupFreeTier() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    await client.query(`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS has_deposited BOOLEAN DEFAULT FALSE;
    `);
    console.log('Added has_deposited column to profiles.');

    // Mark users who already have a real deposit
    await client.query(`
      UPDATE profiles p
      SET has_deposited = TRUE
      WHERE EXISTS (
        SELECT 1 FROM transactions t
        WHERE t.user_id = p.id
          AND t.type = 'deposit'
          AND t.status = 'completed'
          AND (
            t.description ILIKE 'Depósito Flutterwave%'
            OR t.description ILIKE 'Depósito LinkPaga%'
          )
      );
    `);
    console.log('Backfilled has_deposited for existing depositors.');

  } catch (err) {
    console.error('Error executing query', err);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

setupFreeTier();
