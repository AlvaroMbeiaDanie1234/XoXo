import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgres://postgres.gcytdqsugyadxpugiwhg:Alvaro939901639@aws-0-eu-west-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });
try {
  await pool.query('SELECT 1');
  console.log('Project 3 PG: OK');
  const r = await pool.query("SELECT count(*) as cnt FROM pg_tables WHERE schemaname='public'");
  console.log('Public tables count:', r.rows[0].cnt);
} catch(e) { console.log('Project 3 PG ERROR:', e.message); }
pool.end();
