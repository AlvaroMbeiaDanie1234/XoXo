const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const backupPath = path.join(__dirname, 'backup-07-06-2026', 'storage', 'media');
const sqlOutputPath = path.join(__dirname, 'import_storage.sql');

let sql = `
-- Disable triggers temporarily to avoid issues
SET session_replication_role = replica;

`;

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const files = [];
walkDir(backupPath, function(filePath) {
  files.push(filePath);
});

files.forEach(file => {
  // Relative path from the 'media' directory
  let relativePath = path.relative(backupPath, file).replace(/\\/g, '/');
  
  // Extract owner UUID from the path if it starts with a UUID
  let owner = 'null';
  const firstPart = relativePath.split('/')[0];
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (uuidRegex.test(firstPart)) {
    owner = `'${firstPart}'`;
  }

  // Generate a random UUID for the object ID
  const id = crypto.randomUUID();
  const stat = fs.statSync(file);
  const size = stat.size;
  
  // Basic mimetype detection
  const ext = path.extname(file).toLowerCase();
  let mimetype = 'application/octet-stream';
  if (ext === '.jpg' || ext === '.jpeg') mimetype = 'image/jpeg';
  else if (ext === '.png') mimetype = 'image/png';
  else if (ext === '.gif') mimetype = 'image/gif';
  else if (ext === '.webp') mimetype = 'image/webp';
  else if (ext === '.mp4') mimetype = 'video/mp4';
  
  const metadata = JSON.stringify({ mimetype, size });
  
  sql += `INSERT INTO storage.objects (id, bucket_id, name, owner, metadata) VALUES ('${id}', 'media', '${relativePath}', ${owner}, '${metadata}'::jsonb);\n`;
});

sql += `
-- Re-enable triggers
SET session_replication_role = DEFAULT;
`;

fs.writeFileSync(sqlOutputPath, sql);
console.log(`Generated ${files.length} INSERT statements in import_storage.sql`);
