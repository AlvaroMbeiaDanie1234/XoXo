import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function listUsers() {
  try {
    await client.connect();
    const res = await client.query('SELECT id, display_name FROM profiles');
    console.log('Profiles in database:');
    console.table(res.rows);
    
    const postsRes = await client.query('SELECT id, title, user_id FROM posts');
    console.log('Posts in database:');
    console.table(postsRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

listUsers();
