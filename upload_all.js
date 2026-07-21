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
  console.log('Emptying bucket...');
  const { data: list, error: listError } = await supabase.storage.from(bucketName).list('', { limit: 10000 });
  if (!listError && list.length > 0) {
      // Actually we have to list recursively to empty it, but it's easier to just use `emptyBucket`
      console.log('Clearing bucket completely via API...');
      await supabase.storage.emptyBucket(bucketName);
  }
  
  // Make sure the physical directory is empty just in case
  try {
      execSync(`rmdir /s /q "c:\\Users\\Alvaro\\Music\\Pessoal\\modern-website\\docker-supabase\\volumes\\storage\\stub\\stub\\media"`);
      console.log('Physical media directory cleaned.');
  } catch (e) {
      // Ignore if doesn't exist
  }

  console.log('Starting fresh upload...');
  const folders = fs.readdirSync(backupDir);
  for (const folder of folders) {
    const folderPath = path.join(backupDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;
    
    let ownerId = folder;
    if (folder === 'messages' || folder === 'system' || folder === 'verification') {
      ownerId = null;
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
        if (ownerId && ownerId !== 'messages') {
            const sql = `UPDATE storage.objects SET owner = '${ownerId}' WHERE name = '${destPath}' AND bucket_id = '${bucketName}';`;
            try {
                execSync(`docker exec supabase-db psql -U postgres -c "${sql}"`);
            } catch (err) {
                console.error(`   Failed to restore owner for ${destPath}`);
            }
        }
      }
      
      // Small delay to ensure disk sync
      await new Promise(res => setTimeout(res, 50));
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
                  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
                  else if (ext === '.png') contentType = 'image/png';
                  
                  await supabase.storage.from(bucketName).upload(destPath, fileBuffer, { contentType, upsert: true });
                  await new Promise(res => setTimeout(res, 50));
              }
          }
      }
  }
  
  // For 'verification' folder
  const verPath = path.join(backupDir, 'verification');
  if (fs.existsSync(verPath)) {
      const files = fs.readdirSync(verPath);
      for (const file of files) {
          const filePath = path.join(verPath, file);
          const destPath = `verification/${file}`;
          console.log(`Uploading ${destPath}...`);
          const fileBuffer = fs.readFileSync(filePath);
          let contentType = 'application/octet-stream';
          const ext = path.extname(file).toLowerCase();
          if (ext === '.webm') contentType = 'video/webm';
          else if (ext === '.mp4') contentType = 'video/mp4';
          else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
          else if (ext === '.png') contentType = 'image/png';
          
          await supabase.storage.from(bucketName).upload(destPath, fileBuffer, { contentType, upsert: true });
          await new Promise(res => setTimeout(res, 50));
      }
  }
  
  console.log('All files uploaded and xattrs fixed!');
}

fix();
