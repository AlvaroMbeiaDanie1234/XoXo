import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkTable() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'likes' 
      AND table_schema = 'public'
    `);
    console.log('Columns in "likes" table:');
    console.table(res.rows);
    
    const res2 = await client.query("SELECT count(*) FROM likes");
    console.log('Total rows in likes:', res2.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

checkTable();
