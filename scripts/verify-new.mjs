import pg from 'pg';
const { Pool } = pg;
// Use direct non-pooling connection
const pool = new Pool({ connectionString: 'postgres://postgres.gcytdqsugyadxpugiwhg:Alvaro939901639@db.gcytdqsugyadxpugiwhg.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
const tables = ['profiles', 'transactions', 'posts', 'subscriptions', 'system_settings', 'system_announcements'];
for (const t of tables) {
  try {
    const { rows } = await pool.query(`SELECT count(*) as cnt FROM "${t}"`);
    console.log(`${t}: ${rows[0].cnt}`);
  } catch(e) { console.log(`${t}: ERROR - ${e.message.substring(0, 100)}`); }
}
const { rows: authUsers } = await pool.query("SELECT count(*) as cnt FROM auth.users");
console.log(`auth.users: ${authUsers[0].cnt}`);
const { rows: identities } = await pool.query("SELECT count(*) as cnt FROM auth.identities");
console.log(`auth.identities: ${identities[0].cnt}`);
pool.end();
