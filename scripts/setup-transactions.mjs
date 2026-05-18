import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupTransactions() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    // Create transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        amount DECIMAL(12,2) NOT NULL,
        type VARCHAR(20) NOT NULL, -- 'deposit', 'purchase', 'earnings'
        description TEXT,
        status VARCHAR(20) DEFAULT 'completed',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    `);

    console.log('Transactions table created successfully.');
    await client.query("NOTIFY pgrst, 'reload schema';");

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

setupTransactions();
