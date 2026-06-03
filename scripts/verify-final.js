const { Pool } = require('pg');
const db = new Pool({ connectionString: 'postgres://postgres.uonhujkjkpxkvbstgvud:vmlZEP0ux5zBje5m@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });

async function main() {
  const { rows: ext } = await db.query("SELECT extname FROM pg_extension");
  console.log('Extensions:', ext.map(e => e.extname).join(', '));

  const { rows: users } = await db.query("SELECT email FROM auth.users WHERE email LIKE 'admin.xoxo%' LIMIT 5");
  console.log('Admin users:', users.map(u => u.email));

  // Check profiles count
  const { rows: prof } = await db.query("SELECT COUNT(*) FROM profiles");
  console.log('Profiles:', prof[0].count);

  // Check transactions
  const { rows: tx } = await db.query("SELECT COUNT(*) FROM transactions");
  console.log('Transactions:', tx[0].count);

  // Check system_settings
  const { rows: settings } = await db.query("SELECT key, value FROM system_settings WHERE key LIKE 'deposit%'");
  console.log('Deposit settings:', JSON.stringify(settings));

  db.end();
}
main().catch(e => console.error(e)).then(() => process.exit(0));
