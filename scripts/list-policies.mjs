import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function listPolicies() {
  try {
    await client.connect();
    
    // Check if RLS is enabled on profiles
    const rlsRes = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public';
    `);
    console.log('Row-level Security (RLS) status of public tables:');
    console.table(rlsRes.rows);

    // List all policies on profiles
    const policiesRes = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'public';
    `);
    console.log('Database Policies:');
    console.table(policiesRes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

listPolicies();
