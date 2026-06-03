const { Pool } = require('pg');
const newDb = new Pool({ connectionString: 'postgres://postgres.uonhujkjkpxkvbstgvud:vmlZEP0ux5zBje5m@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });
newDb.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' ORDER BY ordinal_position`).then(r => {
  console.log('New project auth.users columns:');
  r.rows.forEach(row => console.log('  ' + row.column_name + ' ' + row.data_type + (row.is_nullable === 'NO' ? ' NOT NULL' : '') + (row.column_default ? ' DEFAULT ' + row.column_default : '')));
  newDb.end();
});
