import { createClient } from '@supabase/supabase-js';

// New project - create bucket
const supabase = createClient(
  'https://gcytdqsugyadxpugiwhg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjeXRkcXN1Z3lhZHhwdWdpd2hnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDM3MDkwMywiZXhwIjoyMDk1OTQ2OTAzfQ.fLmIcE4Gy6vUKpuc-5ICyTV_ZK0Q1it7JRm0L4hV1WM'
);

// Try creating bucket
const { data: bucket, error: bErr } = await supabase.storage.createBucket('media', { public: true });
console.log('Create bucket:', bErr ? bErr.message : 'OK');

// Also ensure bucket exists (idempotent)
const { data: buckets } = await supabase.storage.listBuckets();
console.log('Buckets:', buckets?.map(b => b.name));

// Test upload of a tiny file
const { data: up, error: upErr } = await supabase.storage.from('media').upload('test-migration.txt', new Blob(['migration test']), { upsert: true });
console.log('Test upload:', upErr ? upErr.message : 'OK');
if (up) {
  const { data: pubUrl } = supabase.storage.from('media').getPublicUrl('test-migration.txt');
  console.log('Public URL:', pubUrl.publicUrl);
  // Clean up
  await supabase.storage.from('media').remove(['test-migration.txt']);
}
