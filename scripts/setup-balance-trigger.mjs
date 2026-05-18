import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupBalanceTrigger() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    // 1. Create the function
    const createFunctionSql = `
      CREATE OR REPLACE FUNCTION update_profile_balance()
      RETURNS TRIGGER AS $$
      BEGIN
        IF (TG_OP = 'INSERT') THEN
          IF (NEW.status = 'completed') THEN
            IF (NEW.type = 'deposit' OR NEW.type = 'earnings') THEN
              UPDATE profiles SET balance = COALESCE(balance, 0) + NEW.amount WHERE id = NEW.user_id;
            ELSIF (NEW.type = 'withdraw' OR NEW.type = 'purchase') THEN
              UPDATE profiles SET balance = COALESCE(balance, 0) - NEW.amount WHERE id = NEW.user_id;
            END IF;
          END IF;
        ELSIF (TG_OP = 'UPDATE') THEN
          IF (OLD.status != 'completed' AND NEW.status = 'completed') THEN
             IF (NEW.type = 'deposit' OR NEW.type = 'earnings') THEN
              UPDATE profiles SET balance = COALESCE(balance, 0) + NEW.amount WHERE id = NEW.user_id;
            ELSIF (NEW.type = 'withdraw' OR NEW.type = 'purchase') THEN
              UPDATE profiles SET balance = COALESCE(balance, 0) - NEW.amount WHERE id = NEW.user_id;
            END IF;
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    await client.query(createFunctionSql);
    console.log('Created update_profile_balance function.');

    // 2. Create the trigger
    const createTriggerSql = `
      DROP TRIGGER IF EXISTS trg_update_profile_balance ON transactions;
      CREATE TRIGGER trg_update_profile_balance
      AFTER INSERT OR UPDATE ON transactions
      FOR EACH ROW EXECUTE FUNCTION update_profile_balance();
    `;
    await client.query(createTriggerSql);
    console.log('Created trg_update_profile_balance trigger.');

    // 3. Fix existing balances
    const fixBalancesSql = `
      WITH calculated_balances AS (
        SELECT user_id, 
               COALESCE(SUM(CASE WHEN type IN ('deposit', 'earnings') THEN amount ELSE 0 END), 0) -
               COALESCE(SUM(CASE WHEN type IN ('withdraw', 'purchase') THEN amount ELSE 0 END), 0) as new_balance
        FROM transactions
        WHERE status = 'completed'
        GROUP BY user_id
      )
      UPDATE profiles p
      SET balance = c.new_balance
      FROM calculated_balances c
      WHERE p.id = c.user_id AND COALESCE(p.balance, 0) != c.new_balance;
    `;
    const res = await client.query(fixBalancesSql);
    console.log(`Fixed existing balances for ${res.rowCount} users.`);

  } catch (err) {
    console.error('Error setting up balance trigger:', err);
  } finally {
    await client.end();
  }
}

setupBalanceTrigger();
