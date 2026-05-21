import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkProfilesRls() {
  try {
    await client.connect();
    
    // Check RLS status for profiles
    const rlsRes = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE tablename = 'profiles';
    `);
    console.log('RLS Status:', JSON.stringify(rlsRes.rows, null, 2));

    // Get policies for profiles table
    const policiesRes = await client.query(`
      SELECT policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename = 'profiles';
    `);
    console.log('Policies on profiles:', JSON.stringify(policiesRes.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

checkProfilesRls();
