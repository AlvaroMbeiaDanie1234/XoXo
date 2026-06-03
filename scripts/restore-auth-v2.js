const { Pool } = require('pg');
const fs = require('fs');

const NEW = new Pool({ connectionString: 'postgres://postgres.uonhujkjkpxkvbstgvud:vmlZEP0ux5zBje5m@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });

async function main() {
  await NEW.query("SET session_replication_role = 'replica'");

  // Truncate existing auth data first
  try { await NEW.query('TRUNCATE auth.identities CASCADE'); } catch(e) { console.log('truncate identities:', e.message); }
  try { await NEW.query('DELETE FROM auth.users'); } catch(e) { console.log('delete users:', e.message); }

  // Execute auth backup file directly using pg's ability to run multi-statement SQL
  const authSql = fs.readFileSync('auth-backup-v2.sql', 'utf8');
  try {
    await NEW.query(authSql);
    console.log('Auth restore completed successfully');
  } catch (e) {
    console.error('Auth restore error:', e.message.substring(0, 300));
  }

  const { rows: users } = await NEW.query('SELECT COUNT(*) FROM auth.users');
  console.log('Auth users:', users[0].count);

  const { rows: identities } = await NEW.query('SELECT COUNT(*) FROM auth.identities');
  console.log('Auth identities:', identities[0].count);

  await NEW.query("SET session_replication_role = 'origin'");
  console.log('Done');
  NEW.end();
}
main().catch(e => { console.error('FATAL:', e); NEW.end(); });
