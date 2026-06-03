import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgres://postgres.uonhujkjkpxkvbstgvud:vmlZEP0ux5zBje5m@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });
try {
  const r = await pool.query("SELECT * FROM storage.objects LIMIT 5");
  console.log('Objects found:', r.rows.length);
  if (r.rows.length > 0) console.log('Sample:', JSON.stringify(r.rows[0], null, 2));
} catch(e) { console.log('Error:', e.message); }
pool.end();
