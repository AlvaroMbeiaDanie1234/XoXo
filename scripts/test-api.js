const https = require('https');
const url = 'https://uonhujkjkpxkvbstgvud.supabase.co/rest/v1/';
const opts = {
  headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvbmh1amtqa3B4a3Zic3RndnVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNjM3OTQsImV4cCI6MjA5NTkzOTc5NH0.2KfrkJ6h1jy6iBEjk6V0xijvvFvLqGGF2yGXFVj4Su4' }
};
https.get(url, opts, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', data.substring(0, 500));
  });
}).on('error', e => console.log('Error:', e.message));
