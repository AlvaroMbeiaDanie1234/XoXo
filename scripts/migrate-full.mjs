import pg from 'pg';
const { Pool } = pg;
import fs from 'fs';

const SRC = new Pool({ connectionString: 'postgres://postgres.uonhujkjkpxkvbstgvud:vmlZEP0ux5zBje5m@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });
const DST = new Pool({ connectionString: 'postgres://postgres.gcytdqsugyadxpugiwhg:Alvaro939901639@aws-0-eu-west-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });

// ──────────────────────────────────────────────
//  HELPERS
// ──────────────────────────────────────────────

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return v.toString();
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function exec(pool, stmt, label) {
  try { await pool.query(stmt); return true; }
  catch (e) {
    if (label) console.error(`  [${label}] ${e.message.substring(0, 200)}`);
    return false;
  }
}

// ──────────────────────────────────────────────
//  STEP 1: BACKUP FROM SOURCE
// ──────────────────────────────────────────────

console.log('=== STEP 1: Backup from SOURCE (uonhuj...) ===');

// 1a. Get all public tables
const { rows: tables } = await SRC.query(
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('schema_migrations', '_prisma_migrations') ORDER BY tablename"
);
console.log(`Found ${tables.length} public tables`);

// 1b. Generate CREATE TABLE for each
const schemaSQL = [];
for (const t of tables) {
  const tbl = t.tablename;
  const { rows: cols } = await SRC.query(
    `SELECT column_name, is_nullable, data_type, character_maximum_length, column_default, udt_name
     FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [tbl]
  );
  const { rows: pk } = await SRC.query(
    `SELECT kcu.column_name FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
     WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'`,
    [tbl]
  );
  const { rows: indexes } = await SRC.query(
    `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1 AND indexname NOT LIKE '%_pkey'`,
    [tbl]
  );

  // Check if view
  const { rows: [chk] } = await SRC.query(
    `SELECT table_type FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`, [tbl]
  );
  if (chk?.table_type === 'VIEW') continue;

  let sql = `CREATE TABLE IF NOT EXISTS public."${tbl}" (\n`;
  const colDefs = cols.map(c => {
    let type = c.data_type;
    if (c.udt_name === 'numeric') type = 'numeric';
    else if (c.udt_name === 'int4') type = 'integer';
    else if (c.udt_name === 'int8') type = 'bigint';
    else if (c.udt_name === 'bool') type = 'boolean';
    else if (c.udt_name === 'float8') type = 'double precision';
    else if (c.udt_name === 'jsonb') type = 'jsonb';
    else if (c.udt_name === 'text') type = 'text';
    else if (c.udt_name === 'varchar') type = c.character_maximum_length ? `character varying(${c.character_maximum_length})` : 'character varying';
    else if (c.udt_name === 'uuid') type = 'uuid';
    else if (c.udt_name === 'bytea') type = 'bytea';
    else if (c.udt_name === 'timestamptz') type = 'timestamp with time zone';
    else if (c.udt_name === 'timetz') type = 'time with time zone';
    else if (c.udt_name === 'date') type = 'date';
    else if (c.udt_name === 'time') type = 'time without time zone';
    else if (c.udt_name === 'timestamp') type = 'timestamp without time zone';
    let def = `    "${c.column_name}" ${type}`;
    if (c.is_nullable === 'NO') def += ' NOT NULL';
    if (c.column_default) def += ` DEFAULT ${c.column_default.replace(/'/g, "'")}`;
    return def;
  });
  sql += colDefs.join(',\n');
  if (pk.length > 0) sql += `,\n    PRIMARY KEY (${pk.map(p => `"${p.column_name}"`).join(', ')})`;
  sql += '\n);';
  schemaSQL.push(sql);
  for (const idx of indexes) schemaSQL.push(idx.indexdef.replace(/^CREATE /, 'CREATE IF NOT EXISTS ').replace(/ ON ONLY /, ' ON ') + ';');
}

// 1c. Dump DATA for each table
const dataSQL = [];
for (const t of tables) {
  const tbl = t.tablename;
  try {
    const { rows: [chk] } = await SRC.query(
      `SELECT table_type FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`, [tbl]
    );
    if (chk?.table_type === 'VIEW') continue;
    const { rows: data } = await SRC.query(`SELECT * FROM "${tbl}" ORDER BY 1`);
    if (data.length === 0) continue;
    const cols = Object.keys(data[0]);
    const quotedCols = cols.map(c => `"${c}"`).join(', ');
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const values = batch.map(row => `(${cols.map(c => esc(row[c])).join(', ')})`).join(',\n');
      dataSQL.push(`INSERT INTO public."${tbl}" (${quotedCols}) VALUES \n${values};`);
    }
  } catch (e) { console.error(`  Skipping ${tbl}: ${e.message.substring(0, 100)}`); }
}

console.log(`Schema: ${schemaSQL.length} stmts, Data: ${dataSQL.length} stmts`);

// 1d. Backup auth.users (excluding generated columns)
const { rows: authCols } = await SRC.query(
  "SELECT column_name, is_generated FROM information_schema.columns WHERE table_schema='auth' AND table_name='users' ORDER BY ordinal_position"
);
const insertAuthCols = authCols.filter(c => c.is_generated === 'NEVER').map(c => c.column_name);
const quotedAuthCols = insertAuthCols.map(c => `"${c}"`).join(', ');
const { rows: users } = await SRC.query(`SELECT ${quotedAuthCols} FROM auth.users ORDER BY created_at`);
console.log(`Auth users: ${users.length}`);

let authSQL = `INSERT INTO auth.users (${quotedAuthCols}) VALUES\n`;
authSQL += users.map(row => `(${insertAuthCols.map(c => esc(row[c])).join(', ')})`).join(',\n') + ';\n';

// 1e. Backup auth.identities
const { rows: idCols } = await SRC.query(
  "SELECT column_name, is_generated FROM information_schema.columns WHERE table_schema='auth' AND table_name='identities' ORDER BY ordinal_position"
);
const insertIdCols = idCols.filter(c => c.is_generated === 'NEVER').map(c => c.column_name);
if (insertIdCols.length > 0) {
  const { rows: identities } = await SRC.query(`SELECT ${insertIdCols.map(c => `"${c}"`).join(', ')} FROM auth.identities ORDER BY created_at`);
  if (identities.length > 0) {
    authSQL += `\nINSERT INTO auth.identities (${insertIdCols.map(c => `"${c}"`).join(', ')}) VALUES\n`;
    authSQL += identities.map(row => `(${insertIdCols.map(c => esc(row[c])).join(', ')})`).join(',\n') + ';\n';
    console.log(`Auth identities: ${identities.length}`);
  }
}

// ──────────────────────────────────────────────
//  STEP 2: RESTORE TO DESTINATION
// ──────────────────────────────────────────────

console.log('\n=== STEP 2: Restore to DEST (gcytd...) ===');

// 2a. Enable extensions
console.log('Enabling extensions...');
await exec(DST, 'CREATE EXTENSION IF NOT EXISTS "pgcrypto"', 'ext');
await exec(DST, 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"', 'ext');

// 2b. Bypass triggers
console.log('Setting replica mode...');
await DST.query("SET session_replication_role = 'replica'");

// 2c. Restore auth
console.log('Restoring auth...');
try { await DST.query('TRUNCATE auth.identities CASCADE'); } catch(e) {}
try { await DST.query('DELETE FROM auth.users'); } catch(e) {}
try { await DST.query(authSQL); console.log('Auth OK'); }
catch (e) { console.error('Auth ERROR:', e.message.substring(0, 300)); }

const { rows: aCnt } = await DST.query('SELECT COUNT(*) FROM auth.users');
const { rows: iCnt } = await DST.query('SELECT COUNT(*) FROM auth.identities');
console.log(`Users: ${aCnt[0].count}, Identities: ${iCnt[0].count}`);

// 2d. Restore public schema
console.log('Restoring public schema...');
let schemaOk = 0, schemaFail = 0;
for (const stmt of schemaSQL) {
  const ok = await exec(DST, stmt, null);
  if (ok) schemaOk++; else schemaFail++;
}
console.log(`Schema: ${schemaOk} OK, ${schemaFail} fail/ignore`);

// 2e. Restore data
console.log('Restoring data...');
let dataOk = 0, dataFail = 0;
for (const stmt of dataSQL) {
  try { await DST.query(stmt); dataOk++; }
  catch (e) {
    if (!e.message.includes('duplicate key')) {
      console.error(`  DATA ERROR: ${e.message.substring(0, 150)}`);
    }
    dataOk++; // count duplicate keys as ok
  }
}
console.log(`Data: ${dataOk} stmts executed`);

// 2f. Reset sequences
for (const t of tables) {
  const tbl = t.tablename;
  try {
    const { rows: seqCols } = await DST.query(
      `SELECT column_name, column_default FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_default LIKE '%nextval%'`, [tbl]
    );
    for (const c of seqCols) {
      const m = c.column_default.match(/'([^']+)'/);
      if (m) await exec(DST, `SELECT pg_catalog.setval('${m[1]}', COALESCE((SELECT MAX("${c.column_name}") FROM "${tbl}"), 1), false);`, null);
    }
  } catch(e) {}
}

// 2g. Restore session_replication_role
await DST.query("SET session_replication_role = 'origin'");

const { rows: tblCnt } = await DST.query("SELECT count(*) as cnt FROM pg_tables WHERE schemaname = 'public'");
console.log(`\n=== DONE! Public tables in dest: ${tblCnt[0].cnt} ===`);

SRC.end();
DST.end();
