import { Client } from 'pg';
import * as dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function setupWelcomeBonus() {
  try {
    await client.connect();
    await client.query(`
      INSERT INTO system_settings (key, value)
      VALUES ('welcome_bonus_amount', '1500')
      ON CONFLICT (key) DO NOTHING;
    `);
    console.log('Inserted default welcome_bonus_amount (1500 AOA).');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupWelcomeBonus();
