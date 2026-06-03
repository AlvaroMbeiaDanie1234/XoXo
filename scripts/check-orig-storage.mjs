import pg from 'pg';
const { Pool } = pg;

// Original project 1
const pool = new Pool({ connectionString: 'postgres://postgres.vuyscgfbwhmqydeznphi:qx7AqA2PmiwZuubI@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });
try {
  const r = await pool.query("SELECT * FROM storage.buckets");
  console.log('Buckets:', JSON.stringify(r.rows.map(b => ({ id: b.id, name: b.name, public: b.public }))));
  for (const b of r.rows) {
    const o = await pool.query(`SELECT COUNT(*) as cnt FROM storage.objects WHERE bucket_id = $1`, [b.id]);
    console.log(`  ${b.id}: ${o.rows[0].cnt} objects`);
    if (parseInt(o.rows[0].cnt) > 0) {
      const s = await pool.query(`SELECT SUM((metadata->>'size')::bigint) as total FROM storage.objects WHERE bucket_id = $1`, [b.id]);
      console.log(`  Total size: ${(parseInt(s.rows[0].total || '0') / 1024 / 1024).toFixed(2)} MB`);
    }
  }
} catch(e) { console.log('Error:', e.message); }
pool.end();
