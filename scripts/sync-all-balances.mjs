import { Client } from 'pg';
import * as dotenv from 'dotenv';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function syncAllBalances() {
  try {
    await client.connect();
    const res = await client.query(`
      WITH calculated_balances AS (
        SELECT user_id,
               COALESCE(SUM(CASE WHEN type IN ('deposit', 'earnings') THEN amount ELSE 0 END), 0) -
               COALESCE(SUM(CASE WHEN type IN ('withdraw', 'purchase') THEN amount ELSE 0 END), 0) AS new_balance
        FROM transactions
        WHERE status = 'completed'
        GROUP BY user_id
      )
      UPDATE profiles p
      SET balance = c.new_balance
      FROM calculated_balances c
      WHERE p.id = c.user_id;
    `);
    console.log(`Sincronizados saldos de ${res.rowCount} utilizadores.`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

syncAllBalances();
