const { Pool } = require('pg');
const db = new Pool({ connectionString: 'postgres://postgres.uonhujkjkpxkvbstgvud:vmlZEP0ux5zBje5m@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });
db.query("SELECT column_name, is_generated, generation_expression FROM information_schema.columns WHERE table_schema='auth' AND table_name='users' AND is_generated='ALWAYS'")
  .then(r => { console.log('Generated columns:', JSON.stringify(r.rows)); db.end(); })
  .catch(e => { console.log('ERR:', e.message); db.end(); });
