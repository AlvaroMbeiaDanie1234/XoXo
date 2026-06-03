import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
const { Pool } = pg;

// Try downloading from old project using Supabase JS SDK
// Even with service role, the API gateway blocks restricted projects
const oldSupabase = createClient(
  'https://vuyscgfbwhmqydeznphi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1eXNjZ2Zid2htcXlkZXpucGhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDI3MjQzOCwiZXhwIjoyMDk1ODM4NDM4fQ.YapBm3Qqq6AX-kI32vGBwPTFtqPchNyOCHvqqAPRZ4c'
);

// Try to list files in the old storage
console.log('Trying to access old project storage...');
const { data: files, error: fErr } = await oldSupabase.storage.from('media').list('', { limit: 5 });
if (fErr) {
  console.log('List error:', fErr.message);
} else {
  console.log('Files:', files?.map(f => f.name));
}

// Try listing via REST directly to see error
console.log('\nTrying direct REST API...');
try {
  const resp = await fetch('https://vuyscgfbwhmqydeznphi.supabase.co/storage/v1/object/list/media', {
    headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1eXNjZ2Zid2htcXlkZXpucGhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDI3MjQzOCwiZXhwIjoyMDk1ODM4NDM4fQ.YapBm3Qqq6AX-kI32vGBwPTFtqPchNyOCHvqqAPRZ4c', 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1eXNjZ2Zid2htcXlkZXpucGhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDI3MjQzOCwiZXhwIjoyMDk1ODM4NDM4fQ.YapBm3Qqq6AX-kI32vGBwPTFtqPchNyOCHvqqAPRZ4c' }
  });
  console.log('Status:', resp.status, resp.statusText);
  const text = await resp.text();
  console.log('Body:', text.substring(0, 200));
} catch(e) {
  console.log('Fetch error:', e.message);
}

// Get list of all files from storage.objects via direct PG for reference
console.log('\nGetting file list from storage.objects (old project)...');
const pool = new Pool({ connectionString: 'postgres://postgres.vuyscgfbwhmqydeznphi:qx7AqA2PmiwZuubI@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });
const { rows: objects } = await pool.query("SELECT name, (metadata->>'size')::bigint as size_bytes FROM storage.objects WHERE bucket_id = 'media' ORDER BY name");
console.log(`Total files: ${objects.length}`);
console.log(`Sample paths: ${objects.slice(0, 3).map(o => o.name).join(', ')}`);
pool.end();
