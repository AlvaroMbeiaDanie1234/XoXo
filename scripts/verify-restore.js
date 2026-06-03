const { Pool } = require('pg');
const newDb = new Pool({ connectionString: 'postgres://postgres.uonhujkjkpxkvbstgvud:vmlZEP0ux5zBje5m@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });

async function main() {
  // Check auth users
  const { rows: authCount } = await newDb.query('SELECT COUNT(*) FROM auth.users');
  console.log('Auth users:', authCount[0].count);

  // Check public tables with data
  const { rows: tables } = await newDb.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  console.log('\nPublic tables:');
  for (const t of tables) {
    const { rows } = await newDb.query(`SELECT COUNT(*) as cnt FROM "${t.tablename}"`);
    console.log(`  ${t.tablename}: ${rows[0].cnt} rows`);
  }
}
main().catch(e => console.error(e)).then(() => newDb.end());
