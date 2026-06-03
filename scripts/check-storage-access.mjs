import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgres://postgres.uonhujkjkpxkvbstgvud:vmlZEP0ux5zBje5m@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });
try {
  const r = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'storage' ORDER BY tablename");
  console.log('Storage tables:', r.rows.map(x => x.tablename).join(', '));
  if (r.rows.some(x => x.tablename === 'objects')) {
    const { rows: buckets } = await pool.query("SELECT * FROM storage.buckets");
    console.log('Buckets:', JSON.stringify(buckets.map(b => ({ id: b.id, name: b.name }))));
    for (const b of buckets) {
      const { rows: objs } = await pool.query(`SELECT COUNT(*) as cnt, COALESCE(SUM((metadata->>'size')::bigint), 0) as total_bytes FROM storage.objects WHERE bucket_id = $1`, [b.id]);
      console.log(`  ${b.id}: ${objs[0].cnt} files, ${(objs[0].total_bytes / 1024 / 1024).toFixed(2)} MB`);
    }
  }
} catch(e) { console.log('Error:', e.message); }
pool.end();
