import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function listUsers() {
  try {
    await client.connect();
    const res = await client.query('SELECT id, display_name, balance FROM profiles');
    console.log('Profiles and balances in database:');
    console.table(res.rows);
    
    const txnRes = await client.query('SELECT id, user_id, amount, type, status, description, created_at FROM transactions ORDER BY created_at DESC LIMIT 20');
    console.log('Recent transactions in database:');
    console.table(txnRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

listUsers();
