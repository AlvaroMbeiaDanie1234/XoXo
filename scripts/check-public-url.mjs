import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: 'postgres://postgres.vuyscgfbwhmqydeznphi:qx7AqA2PmiwZuubI@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });

// Get first 3 objects
const { rows: objects } = await pool.query("SELECT name, bucket_id, metadata FROM storage.objects WHERE bucket_id = 'media' LIMIT 3");
console.log('Sample objects:', objects.map(o => ({ name: o.name, size: o.metadata?.size })));

// Test public URL access
for (const obj of objects) {
  const url = `https://vuyscgfbwhmqydeznphi.supabase.co/storage/v1/object/public/media/${obj.name}`;
  try {
    const resp = await fetch(url, { method: 'HEAD' });
    console.log(`  ${obj.name}: HTTP ${resp.status} ${resp.statusText}`);
  } catch(e) {
    console.log(`  ${obj.name}: fetch error - ${e.message}`);
  }
}
pool.end();
