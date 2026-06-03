const { Pool } = require('pg');
const fs = require('fs');

const NEW = new Pool({ connectionString: 'postgres://postgres.uonhujkjkpxkvbstgvud:vmlZEP0ux5zBje5m@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });

async function runStatements(pool, label, sql) {
  const statements = sql
    .split(';\n')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`\n[${label}] Executing ${statements.length} statements...`);
  let ok = 0, fail = 0;
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      let clean = stmt;
      if (clean.startsWith('CREATE IF NOT EXISTS INDEX'))
        clean = clean.replace('CREATE IF NOT EXISTS INDEX', 'CREATE INDEX IF NOT EXISTS');
      else if (clean.startsWith('CREATE IF NOT EXISTS UNIQUE INDEX'))
        clean = clean.replace('CREATE IF NOT EXISTS UNIQUE INDEX', 'CREATE UNIQUE INDEX IF NOT EXISTS');
      
      await pool.query(clean);
      ok++;
    } catch (e) {
      if (!e.message.includes('already exists') && !e.message.includes('duplicate key value violates unique constraint')) {
        console.error(`  Error #${i}: ${e.message.substring(0, 150)}`);
        console.error(`  SQL: ${stmt.substring(0, 150)}`);
        fail++;
      } else {
        ok++;
      }
    }
  }
  console.log(`[${label}] Done: ${ok} OK, ${fail} failed`);
  return fail;
}

async function main() {
  // 1. Enable extensions
  console.log('Enabling extensions...');
  await NEW.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  await NEW.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // 2. Bypass triggers and FK constraints
  console.log('Setting session_replication_role = replica...');
  await NEW.query("SET session_replication_role = 'replica'");

  // 3. Restore auth data
  const authSql = fs.readFileSync('auth-backup.sql', 'utf8');
  // Split auth.sql into individual statements - they end with ;\n
  const authStatements = authSql
    .split(';\n')
    .map(s => s.trim() + ';')
    .filter(s => s.length > 1 && !s.startsWith('--'));
  
  console.log(`\n[Auth] Restoring auth data (${authStatements.length} statements)...`);
  for (const stmt of authStatements) {
    if (stmt.length < 5) continue;
    try {
      await NEW.query(stmt);
    } catch (e) {
      if (!e.message.includes('already exists') && !e.message.includes('duplicate key')) {
        console.error(`  Error: ${e.message.substring(0, 200)}`);
        console.error(`  SQL: ${stmt.substring(0, 200)}`);
      }
    }
  }

  // 4. Restore public schema (tables + data)
  const publicSql = fs.readFileSync('backup.sql', 'utf8');
  await runStatements(NEW, 'Public Schema', publicSql);

  // 5. Restore session_replication_role
  console.log('\nRestoring session_replication_role...');
  await NEW.query("SET session_replication_role = 'origin'");

  console.log('\n=== RESTORE COMPLETE ===');
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) }).then(() => NEW.end());
