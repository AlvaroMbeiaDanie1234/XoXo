const { Pool } = require('pg');
const fs = require('fs');

const OLD = new Pool({ connectionString: 'postgres://postgres.vuyscgfbwhmqydeznphi:qx7AqA2PmiwZuubI@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });

async function main() {
  // Export auth.users
  const { rows: users } = await OLD.query('SELECT * FROM auth.users ORDER BY created_at');
  console.log('Auth users to export:', users.length);
  
  const cols = Object.keys(users[0]);
  const quotedCols = cols.map(c => `"${c}"`).join(', ');
  
  let sql = '-- AUTH USERS\n';
  sql += `INSERT INTO auth.users (${quotedCols}) VALUES\n`;
  
  const valueRows = users.map(row => {
    return '(' + cols.map(c => {
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
  
  // Export auth.identities
  const { rows: identities } = await OLD.query('SELECT * FROM auth.identities ORDER BY created_at');
  if (identities.length > 0) {
    const iCols = Object.keys(identities[0]);
    sql += '\n-- AUTH IDENTITIES\n';
    sql += `INSERT INTO auth.identities (${iCols.map(c => `"${c}"`).join(', ')}) VALUES\n`;
    sql += identities.map(row => {
      return '(' + iCols.map(c => {
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
  
  fs.writeFileSync('auth-backup.sql', sql, 'utf8');
  console.log('Auth backup written to auth-backup.sql (' + (fs.statSync('auth-backup.sql').size / 1024).toFixed(1) + ' KB)');
}
main().catch(e => { console.error('ERR:', e); process.exit(1) }).then(() => OLD.end());
