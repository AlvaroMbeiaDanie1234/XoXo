const { Pool } = require('pg');
const db = new Pool({ connectionString: 'postgres://postgres.uonhujkjkpxkvbstgvud:vmlZEP0ux5zBje5m@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });
db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name IN ('show_phone','is_public','show_gender')")
  .then(r => { console.log('Cols:', r.rows.map(c => c.column_name).join(', ') || 'NONE'); db.end(); })
  .catch(e => { console.log('ERR:', e.message); db.end(); });
