import { Client } from 'pg';
import * as dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function setupWalletPrefs() {
  try {
    await client.connect();

    const columns = [
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(10) DEFAULT 'AOA';`,
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_country VARCHAR(5) DEFAULT 'AO';`,
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_account_name TEXT;`,
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_name TEXT;`,
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_account_number TEXT;`,
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_branch TEXT;`,
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_pix TEXT;`,
    ];

    for (const sql of columns) {
      await client.query(sql);
    }

    console.log('Wallet preference columns added to profiles.');
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupWalletPrefs();
