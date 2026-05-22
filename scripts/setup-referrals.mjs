import { Client } from 'pg';
import * as dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL;

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function setupReferrals() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    await client.query(`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
    `);
    console.log('Added referral_code column to profiles.');

    await client.query(`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id);
    `);
    console.log('Added referred_by column to profiles.');

    await client.query(`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS referral_bonus_paid_at TIMESTAMPTZ;
    `);
    console.log('Added referral_bonus_paid_at column to profiles.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        referred_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        bonus_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        status VARCHAR(20) DEFAULT 'completed',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(referred_id)
      );
    `);
    console.log('Created referrals table.');

    await client.query(`
      INSERT INTO system_settings (key, value)
      VALUES ('referral_bonus_amount', '5000')
      ON CONFLICT (key) DO NOTHING;
    `);
    console.log('Inserted default referral_bonus_amount setting.');

    // Backfill referral codes for existing profiles
    const { rows } = await client.query(`
      SELECT id FROM profiles WHERE referral_code IS NULL;
    `);
    for (const row of rows) {
      const code = row.id.replace(/-/g, '').slice(0, 10).toUpperCase();
      await client.query(
        `UPDATE profiles SET referral_code = $1 WHERE id = $2`,
        [code, row.id]
      );
    }
    console.log(`Backfilled referral_code for ${rows.length} profiles.`);

  } catch (err) {
    console.error('Error executing query', err);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

setupReferrals();
