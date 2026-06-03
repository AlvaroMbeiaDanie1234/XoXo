const { Pool } = require('pg');
const old = new Pool({ connectionString: 'postgres://postgres.vuyscgfbwhmqydeznphi:qx7AqA2PmiwZuubI@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });
old.query(`SELECT conrelid::regclass AS table_name, a.attname AS column_name, confrelid::regclass AS ref_table
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
  WHERE c.confrelid = 'auth.users'::regclass
  ORDER BY 1`).then(r => { 
  console.log('Tables referencing auth.users:');
  r.rows.forEach(row => console.log('  ' + row.table_name + '.' + row.column_name + ' -> ' + row.ref_table));
  old.end();
});
