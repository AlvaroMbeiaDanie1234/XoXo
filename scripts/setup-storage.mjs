import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupStorage() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error("Error listing buckets:", listError);
    return;
  }
  
  const bucketName = 'media';
  const bucketExists = buckets.find(b => b.name === bucketName);
  
  if (!bucketExists) {
    console.log(`Bucket '${bucketName}' not found. Creating...`);
    const { data, error } = await supabase.storage.createBucket(bucketName, { public: true });
    if (error) {
      console.error("Error creating bucket:", error);
    } else {
      console.log("Bucket created successfully:", data);
    }
  } else {
    console.log(`Bucket '${bucketName}' already exists. Making sure it's public...`);
    await supabase.storage.updateBucket(bucketName, { public: true });
    console.log("Bucket is ready.");
  }
}

setupStorage();
