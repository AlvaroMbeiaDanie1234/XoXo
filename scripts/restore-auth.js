const { Pool } = require('pg');
const fs = require('fs');

const NEW = new Pool({ connectionString: 'postgres://postgres.uonhujkjkpxkvbstgvud:vmlZEP0ux5zBje5m@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });

async function main() {
  await NEW.query("SET session_replication_role = 'replica'");

  // 1. Restore auth data - the file is one big INSERT per table
  console.log('Restoring auth users...');
  const authSql = fs.readFileSync('auth-backup.sql', 'utf8');
  const authStmts = authSql.split(';\n').filter(s => s.trim().length > 0 && !s.trim().startsWith('--'));
  for (const stmt of authStmts) {
    if (stmt.trim().length < 10) continue;
    try {
      await NEW.query(stmt.trim() + ';');
      console.log('  Auth statement executed (' + stmt.trim().substring(0, 50) + '...)');
    } catch (e) {
      if (!e.message.includes('already exists') && !e.message.includes('duplicate key')) {
        console.error('  Auth error:', e.message.substring(0, 200));
      } else {
        console.log('  Already exists, skipped');
      }
    }
  }

  // 2. Verify auth users
  const { rows: users } = await NEW.query('SELECT COUNT(*) FROM auth.users');
  console.log('Auth users after restore:', users[0].count);

  const { rows: identities } = await NEW.query('SELECT COUNT(*) FROM auth.identities');
  console.log('Auth identities:', identities[0].count);

  // 3. Verify public tables
  const { rows: tables } = await NEW.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('schema_migrations', '_prisma_migrations') ORDER BY tablename");
  console.log('\nPublic tables:');
  for (const t of tables) {
    try {
      const { rows } = await NEW.query(`SELECT COUNT(*) as cnt FROM "${t.tablename}"`);
      console.log(`  ${t.tablename}: ${rows[0].cnt} rows`);
    } catch (e) {
      console.log(`  ${t.tablename}: ERROR - ${e.message.substring(0, 80)}`);
    }
  }

  await NEW.query("SET session_replication_role = 'origin'");
  console.log('\n=== DONE ===');
}
main().catch(e => console.error('FATAL:', e)).then(() => NEW.end());
