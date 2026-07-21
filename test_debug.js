const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'http://localhost:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const file = 'c:/Users/Alvaro/Music/Pessoal/modern-website/backup-07-06-2026/storage/media/970e09ef-cb34-4b97-9ab8-0f16167e976e/0.8354635429074425.mp4';
  const destPath = '970e09ef-cb34-4b97-9ab8-0f16167e976e/0.8354635429074425.mp4';
  
  console.log('Uploading...', destPath);
  const fileBuffer = fs.readFileSync(file);
  
  const { data, error } = await supabase.storage
    .from('media')
    .upload(destPath, fileBuffer, {
      contentType: 'video/mp4',
      upsert: true
    });
    
  console.log('Upload Result:', data, error);
}

test();
