import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupRPC() {
  try {
    await client.connect();
    console.log('Connected to Postgres');

    await client.query(`
      CREATE OR REPLACE FUNCTION get_post_counts()
      RETURNS TABLE(user_id UUID, count BIGINT)
      LANGUAGE SQL
      STABLE
      AS $$
        SELECT p.user_id, COUNT(*)::BIGINT AS count
        FROM posts p
        GROUP BY p.user_id
        ORDER BY count DESC;
      $$;
    `);

    console.log('RPC get_post_counts created successfully.');

  } catch (err) {
    console.error('Error creating RPC:', err);
  } finally {
    await client.end();
  }
}

setupRPC();
