const { Pool } = require('pg');
const fs = require('fs');

const OLD = new Pool({ connectionString: 'postgres://postgres.vuyscgfbwhmqydeznphi:qx7AqA2PmiwZuubI@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });

async function main() {
  // Get columns excluding generated ones
  const { rows: cols } = await OLD.query(
    "SELECT column_name, is_generated FROM information_schema.columns WHERE table_schema='auth' AND table_name='users' ORDER BY ordinal_position"
  );
  const insertCols = cols.filter(c => c.is_generated === 'NEVER').map(c => c.column_name);
  const quotedCols = insertCols.map(c => `"${c}"`).join(', ');
  console.log('Insert columns:', insertCols.join(', '));

  // Export auth.users
  const { rows: users } = await OLD.query(`SELECT ${quotedCols} FROM auth.users ORDER BY created_at`);
  console.log('Auth users to export:', users.length);

  let sql = '-- AUTH USERS\n';
  sql += `INSERT INTO auth.users (${quotedCols}) VALUES\n`;

  const valueRows = users.map(row => {
    return '(' + insertCols.map(c => {
      const v = row[c];
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'number') return v.toString();
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      if (v instanceof Date) return `'${v.toISOString()}'`;
      if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
      return `'${String(v).replace(/'/g, "''")}'`;
    }).join(', ') + ')';
  });

  sql += valueRows.join(',\n') + ';\n';

  // Export auth.identities (check if it has generated columns too)
  const { rows: idCols } = await OLD.query(
    "SELECT column_name, is_generated FROM information_schema.columns WHERE table_schema='auth' AND table_name='identities' ORDER BY ordinal_position"
  );
  const idInsertCols = idCols.filter(c => c.is_generated === 'NEVER').map(c => c.column_name);
  if (idInsertCols.length > 0) {
    const { rows: identities } = await OLD.query(`SELECT ${idInsertCols.map(c => `"${c}"`).join(', ')} FROM auth.identities ORDER BY created_at`);
    if (identities.length > 0) {
      sql += '\n-- AUTH IDENTITIES\n';
      sql += `INSERT INTO auth.identities (${idInsertCols.map(c => `"${c}"`).join(', ')}) VALUES\n`;
      sql += identities.map(row => {
        return '(' + idInsertCols.map(c => {
          const v = row[c];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return v.toString();
          if (typeof v === 'boolean') return v ? 'true' : 'false';
          if (v instanceof Date) return `'${v.toISOString()}'`;
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
          return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ') + ')';
      }).join(',\n') + ';\n';
    }
  }

  fs.writeFileSync('auth-backup-v2.sql', sql, 'utf8');
  console.log('Written to auth-backup-v2.sql (' + (fs.statSync('auth-backup-v2.sql').size / 1024).toFixed(1) + ' KB)');
}
main().catch(e => { console.error('ERR:', e); process.exit(1) }).then(() => OLD.end());
