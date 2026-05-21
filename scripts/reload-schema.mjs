import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function reloadSchema() {
  try {
    await client.connect();
    console.log('Connected to Postgres');
    
    // Reload PostgREST schema cache
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log("Sent 'reload schema' notification to PostgREST successfully.");

  } catch (err) {
    console.error('Error reloading schema:', err);
  } finally {
    await client.end();
  }
}

reloadSchema();
