const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const supabaseUrl = 'http://localhost:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const supabase = createClient(supabaseUrl, supabaseKey);

const bucketName = 'media';
const backupDir = path.join(__dirname, 'backup-07-06-2026', 'storage', 'media');

async function fix() {
  console.log('Fetching existing objects to preserve owners...');
  const { data: objects, error } = await supabase.storage.from(bucketName).list('', { limit: 10000 });
  if (error) {
    console.error('Failed to list objects:', error);
    return;
  }
  
  // We actually need the owners from the DB directly because the JS API doesn't expose owner easily.
  // Instead of querying via API, we'll just extract the owner from the folder name, which is the user ID.
  
  const folders = fs.readdirSync(backupDir);
  for (const folder of folders) {
    const folderPath = path.join(backupDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;
    
    // The folder name is the owner UUID (unless it's 'messages' etc)
    let ownerId = folder;
    if (folder === 'messages' || folder === 'system') {
      ownerId = null; // We can't easily guess, so leave null
    }

    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      if (!fs.statSync(filePath).isFile()) continue;

      const destPath = `${folder}/${file}`;
      console.log(`Uploading ${destPath}...`);
      
      const fileBuffer = fs.readFileSync(filePath);
      
      let contentType = 'application/octet-stream';
      const ext = path.extname(file).toLowerCase();
      if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.gif') contentType = 'image/gif';
      else if (ext === '.webp') contentType = 'image/webp';
      else if (ext === '.mp4') contentType = 'video/mp4';
      else if (ext === '.mov') contentType = 'video/quicktime';
      else if (ext === '.webm') contentType = 'video/webm';
      else if (ext === '.heic') contentType = 'image/heic';
      else if (ext === '.heif') contentType = 'image/heif';

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(destPath, fileBuffer, {
          contentType: contentType,
          upsert: true
        });

      if (uploadError) {
        console.error(`Error uploading ${destPath}:`, uploadError.message);
      } else {
        // Now restore the owner in the DB!
        if (ownerId && ownerId !== 'messages') {
            const sql = `UPDATE storage.objects SET owner = '${ownerId}' WHERE name = '${destPath}' AND bucket_id = '${bucketName}';`;
            try {
                execSync(`docker exec supabase-db psql -U postgres -c "${sql}"`);
                console.log(`   Owner restored to ${ownerId} for ${destPath}`);
            } catch (err) {
                console.error(`   Failed to restore owner for ${destPath}`);
            }
        }
      }
    }
  }
  
  // For 'messages' folder
  const msgPath = path.join(backupDir, 'messages');
  if (fs.existsSync(msgPath)) {
      const msgFolders = fs.readdirSync(msgPath);
      for (const f of msgFolders) {
          const innerPath = path.join(msgPath, f);
          if (fs.statSync(innerPath).isDirectory()) {
              const files = fs.readdirSync(innerPath);
              for (const file of files) {
                  const filePath = path.join(innerPath, file);
                  const destPath = `messages/${f}/${file}`;
                  console.log(`Uploading ${destPath}...`);
                  const fileBuffer = fs.readFileSync(filePath);
                  let contentType = 'application/octet-stream';
                  const ext = path.extname(file).toLowerCase();
                  if (ext === '.webm') contentType = 'video/webm';
                  else if (ext === '.mp4') contentType = 'video/mp4';
                  
                  await supabase.storage.from(bucketName).upload(destPath, fileBuffer, { contentType, upsert: true });
              }
          }
      }
  }
  
  console.log('All files uploaded and xattrs fixed!');
}

fix();
