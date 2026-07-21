import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const { Pool } = pg;

// 1. Load environment variables
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else if (fs.existsSync('.env')) {
  dotenv.config({ path: '.env' });
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Error: Supabase URL or Service Role Key is missing in environment variables.");
  process.exit(1);
}

// 2. Identify the active project and database credentials
const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
if (!match) {
  console.error("Error: Could not parse project reference from Supabase URL:", supabaseUrl);
  process.exit(1);
}
const projRef = match[1];
console.log(`Active Supabase Project: ${projRef}`);
console.log(`Supabase URL: ${supabaseUrl}`);

const DB_MAPPING = {
  'vuyscgfbwhmqydeznphi': {
    connectionString: 'postgres://postgres.vuyscgfbwhmqydeznphi:qx7AqA2PmiwZuubI@aws-1-us-east-1.pooler.supabase.com:6543/postgres'
  },
  'uonhujkjkpxkvbstgvud': {
    connectionString: 'postgres://postgres.uonhujkjkpxkvbstgvud:vmlZEP0ux5zBje5m@aws-1-us-east-1.pooler.supabase.com:6543/postgres'
  },
  'gcytdqsugyadxpugiwhg': {
    connectionString: 'postgres://postgres.gcytdqsugyadxpugiwhg:Alvaro939901639@aws-0-eu-west-1.pooler.supabase.com:6543/postgres'
  }
};

const dbCreds = DB_MAPPING[projRef];
const connectionString = process.env.DATABASE_URL || dbCreds?.connectionString;

if (!connectionString) {
  console.error(`Error: Could not resolve connection string for project: ${projRef}`);
  process.exit(1);
}

console.log(`Connecting to database: ${connectionString.replace(/:([^@:]+)@/, ':****@')}`);

// 3. Define output path
const BACKUP_DIR = path.resolve('backup-07-06-2026');
const DB_DIR = path.join(BACKUP_DIR, 'database');
const STORAGE_DIR = path.join(BACKUP_DIR, 'storage');

// Create directories if they do not exist
fs.mkdirSync(DB_DIR, { recursive: true });
fs.mkdirSync(STORAGE_DIR, { recursive: true });

const dbPool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

// Helper to escape values for SQL
function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return v.toString();
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function runBackup() {
  const metadata = {
    backup_date: new Date().toISOString(),
    project_reference: projRef,
    supabase_url: supabaseUrl,
    database: {
      tables: [],
      views: [],
      enums: [],
      total_rows: 0
    },
    storage: {
      buckets: [],
      total_files: 0,
      total_bytes: 0
    },
    status: 'IN_PROGRESS'
  };

  try {
    // ==========================================
    // A. DATABASE BACKUP
    // ==========================================
    console.log('\n--- Starting Database Backup ---');

    // 1. Export ENUM custom types
    console.log('Exporting custom types/enums...');
    const enumSQL = [];
    enumSQL.push('-- ============================================================');
    enumSQL.push('-- CUSTOM ENUMS');
    enumSQL.push('-- ============================================================');
    
    const { rows: customEnums } = await dbPool.query(`
      SELECT t.typname as type_name, 
             string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) as enum_values
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      GROUP BY t.typname
      ORDER BY t.typname;
    `);

    for (const e of customEnums) {
      enumSQL.push(`DO $$ BEGIN`);
      enumSQL.push(`    CREATE TYPE public."${e.type_name}" AS ENUM (${e.enum_values});`);
      enumSQL.push(`EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
      metadata.database.enums.push(e.type_name);
    }
    enumSQL.push('\n');

    // 2. Query all tables in public schema
    const { rows: tables } = await dbPool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('schema_migrations', '_prisma_migrations') ORDER BY tablename"
    );
    console.log(`Found ${tables.length} tables in public schema.`);

    const schemaSQL = [...enumSQL];
    schemaSQL.push('-- ============================================================');
    schemaSQL.push('-- SCHEMA TABLES');
    schemaSQL.push('-- ============================================================');
    schemaSQL.push('');

    const dataSQL = [];
    dataSQL.push('-- ============================================================');
    dataSQL.push('-- DATA INSERT STATEMENTS');
    dataSQL.push('-- ============================================================');
    dataSQL.push('');

    // Fetch views to handle them differently
    const { rows: views } = await dbPool.query(
      "SELECT viewname FROM pg_views WHERE schemaname = 'public' ORDER BY viewname"
    );
    const viewNames = new Set(views.map(v => v.viewname));

    for (const t of tables) {
      const tbl = t.tablename;
      if (viewNames.has(tbl)) {
        metadata.database.views.push(tbl);
        continue; // handled below in views dump
      }

      metadata.database.tables.push(tbl);
      console.log(`Processing table: ${tbl}`);

      // Query columns
      const { rows: cols } = await dbPool.query(
        `SELECT column_name, is_nullable, data_type, character_maximum_length, column_default, udt_name
         FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = $1 
         ORDER BY ordinal_position`,
        [tbl]
      );

      // Query PK constraints
      const { rows: pk } = await dbPool.query(
        `SELECT kcu.column_name 
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
         WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'`,
        [tbl]
      );

      // Query indexes
      const { rows: indexes } = await dbPool.query(
        `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1 AND indexname NOT LIKE '%_pkey'`,
        [tbl]
      );

      // Query sequences
      const { rows: sequences } = await dbPool.query(
        `SELECT pg_get_serial_sequence('"${tbl}"', column_name) AS seq
         FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = $1 
           AND column_default LIKE 'nextval%'`,
        [tbl]
      );

      // DDL for Table
      let sql = `CREATE TABLE IF NOT EXISTS public."${tbl}" (\n`;
      const colDefs = cols.map(c => {
        let type = c.data_type;
        if (type === 'ARRAY') {
          const elemUdtName = c.udt_name.substring(1);
          let elemType = elemUdtName;
          if (elemUdtName === 'numeric') elemType = 'numeric';
          else if (elemUdtName === 'int4') elemType = 'integer';
          else if (elemUdtName === 'int8') elemType = 'bigint';
          else if (elemUdtName === 'bool') elemType = 'boolean';
          else if (elemUdtName === 'float8') elemType = 'double precision';
          else if (elemUdtName === 'jsonb') elemType = 'jsonb';
          else if (elemUdtName === 'text') elemType = 'text';
          else if (elemUdtName === 'uuid') elemType = 'uuid';
          else if (elemUdtName === 'varchar') elemType = 'character varying';
          type = `${elemType}[]`;
        } else {
          if (c.udt_name === 'numeric') type = 'numeric';
          else if (c.udt_name === 'int4') type = 'integer';
          else if (c.udt_name === 'int8') type = 'bigint';
          else if (c.udt_name === 'bool') type = 'boolean';
          else if (c.udt_name === 'float8') type = 'double precision';
          else if (c.udt_name === 'jsonb') type = 'jsonb';
          else if (c.udt_name === 'text') type = 'text';
          else if (c.udt_name === 'varchar') type = c.character_maximum_length ? `character varying(${c.character_maximum_length})` : 'character varying';
          else if (c.udt_name === 'uuid') type = 'uuid';
          else if (c.udt_name === 'bytea') type = 'bytea';
          else if (c.udt_name === 'timestamptz') type = 'timestamp with time zone';
          else if (c.udt_name === 'timetz') type = 'time with time zone';
          else if (c.udt_name === 'date') type = 'date';
          else if (c.udt_name === 'time') type = 'time without time zone';
          else if (c.udt_name === 'timestamp') type = 'timestamp without time zone';
          else if (type === 'USER-DEFINED') type = `public."${c.udt_name}"`;
        }

        let def = `    "${c.column_name}" ${type}`;
        if (c.is_nullable === 'NO') def += ' NOT NULL';
        if (c.column_default) {
          let dflt = c.column_default;
          if (dflt.includes('nextval')) {
            const m = dflt.match(/'([^']+)'/);
            if (m) dflt = `nextval('${m[1]}'::regclass)`;
          }
          def += ` DEFAULT ${dflt}`;
        }
        return def;
      });

      sql += colDefs.join(',\n');
      if (pk.length > 0) {
        sql += `,\n    PRIMARY KEY (${pk.map(p => `"${p.column_name}"`).join(', ')})`;
      }
      sql += '\n);\n';
      schemaSQL.push(sql);

      // Indexes
      for (const idx of indexes) {
        schemaSQL.push(idx.indexdef.replace(/^CREATE /, 'CREATE IF NOT EXISTS ').replace(/ ON ONLY /, ' ON ') + ';');
      }

      // Sequences maxval sync
      for (const seq of sequences) {
        if (seq.seq) {
          const seqName = seq.seq.split('.')[1].replace(/"/g, '');
          schemaSQL.push(`SELECT pg_catalog.setval('"${seqName}"', COALESCE((SELECT MAX(id) FROM "${tbl}"), 1), false);`);
        }
      }
      schemaSQL.push('');

      // Dump DATA for this table
      try {
        const { rows: data } = await dbPool.query(`SELECT * FROM "${tbl}" ORDER BY 1`);
        if (data.length > 0) {
          const keys = Object.keys(data[0]);
          const quotedCols = keys.map(k => `"${k}"`).join(', ');
          const batchSize = 100;
          for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            const values = batch.map(row => `(${keys.map(k => esc(row[k])).join(', ')})`).join(',\n');
            dataSQL.push(`INSERT INTO public."${tbl}" (${quotedCols}) VALUES \n${values}\nON CONFLICT DO NOTHING;`);
          }
          metadata.database.total_rows += data.length;
          console.log(`  Dumped ${data.length} rows`);
        }
      } catch (e) {
        console.error(`  Error dumping data for table ${tbl}:`, e.message);
        dataSQL.push(`-- Error dumping data for ${tbl}: ${e.message}`);
      }
    }

    // 3. Export VIEWS
    if (views.length > 0) {
      schemaSQL.push('\n-- ============================================================');
      schemaSQL.push('-- VIEWS');
      schemaSQL.push('-- ============================================================');
      schemaSQL.push('');
      for (const v of views) {
        const vName = v.viewname;
        metadata.database.views.push(vName);
        console.log(`Processing view: ${vName}`);
        try {
          const { rows: viewDef } = await dbPool.query(
            `SELECT pg_catalog.pg_get_viewdef('"${vName}"'::regclass, true) AS view_def`
          );
          if (viewDef[0]?.view_def) {
            schemaSQL.push(`CREATE OR REPLACE VIEW public."${vName}" AS\n${viewDef[0].view_def.trim()};\n`);
          }
        } catch (e) {
          console.error(`  Error dumping view ${vName}:`, e.message);
          schemaSQL.push(`-- Error dumping view ${vName}: ${e.message}`);
        }
      }
    }

    // Write public schema and data files
    fs.writeFileSync(path.join(DB_DIR, 'public_schema.sql'), schemaSQL.join('\n'), 'utf8');
    fs.writeFileSync(path.join(DB_DIR, 'public_data.sql'), dataSQL.join('\n'), 'utf8');
    console.log('Database public schema & data successfully dumped.');

    // 4. Export Auth tables
    console.log('Exporting auth.users and auth.identities...');
    let authSQL = '-- ============================================================\n';
    authSQL += '-- AUTH USERS & IDENTITIES\n';
    authSQL += '-- ============================================================\n\n';

    // auth.users
    try {
      const { rows: authCols } = await dbPool.query(
        "SELECT column_name, is_generated FROM information_schema.columns WHERE table_schema='auth' AND table_name='users' ORDER BY ordinal_position"
      );
      const insertAuthCols = authCols.filter(c => c.is_generated === 'NEVER').map(c => c.column_name);
      const quotedAuthCols = insertAuthCols.map(c => `"${c}"`).join(', ');

      const { rows: users } = await dbPool.query(`SELECT ${quotedAuthCols} FROM auth.users ORDER BY created_at`);
      console.log(`  Found ${users.length} auth.users`);
      if (users.length > 0) {
        authSQL += `INSERT INTO auth.users (${quotedAuthCols}) VALUES\n`;
        authSQL += users.map(row => `(${insertAuthCols.map(c => esc(row[c])).join(', ')})`).join(',\n') + '\nON CONFLICT DO NOTHING;\n\n';
        metadata.database.total_rows += users.length;
      }
    } catch (e) {
      console.error('  Error exporting auth.users:', e.message);
      authSQL += `-- Error exporting auth.users: ${e.message}\n\n`;
    }

    // auth.identities
    try {
      const { rows: idCols } = await dbPool.query(
        "SELECT column_name, is_generated FROM information_schema.columns WHERE table_schema='auth' AND table_name='identities' ORDER BY ordinal_position"
      );
      const insertIdCols = idCols.filter(c => c.is_generated === 'NEVER').map(c => c.column_name);
      if (insertIdCols.length > 0) {
        const { rows: identities } = await dbPool.query(`SELECT ${insertIdCols.map(c => `"${c}"`).join(', ')} FROM auth.identities ORDER BY created_at`);
        console.log(`  Found ${identities.length} auth.identities`);
        if (identities.length > 0) {
          authSQL += `INSERT INTO auth.identities (${insertIdCols.map(c => `"${c}"`).join(', ')}) VALUES\n`;
          authSQL += identities.map(row => `(${insertIdCols.map(c => esc(row[c])).join(', ')})`).join(',\n') + '\nON CONFLICT DO NOTHING;\n\n';
          metadata.database.total_rows += identities.length;
        }
      }
    } catch (e) {
      console.error('  Error exporting auth.identities:', e.message);
      authSQL += `-- Error exporting auth.identities: ${e.message}\n\n`;
    }

    fs.writeFileSync(path.join(DB_DIR, 'auth_data.sql'), authSQL, 'utf8');
    console.log('Database auth schema data successfully dumped.');

    // ==========================================
    // B. STORAGE BACKUP
    // ==========================================
    console.log('\n--- Starting Storage Buckets Backup ---');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // List all buckets
    const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
    if (bErr) {
      throw new Error(`Failed to list storage buckets: ${bErr.message}`);
    }

    console.log(`Found ${buckets.length} buckets: ${buckets.map(b => b.name).join(', ')}`);

    // Recursive helper to list all files in a bucket
    async function listAllFiles(bucketId, folderPath = '') {
      let files = [];
      let offset = 0;
      const limit = 100;
      while (true) {
        const { data, error } = await supabase.storage.from(bucketId).list(folderPath, {
          limit,
          offset,
          sortBy: { column: 'name', order: 'asc' }
        });
        if (error) {
          console.error(`  Error listing folder '${folderPath}' in bucket '${bucketId}':`, error.message);
          break;
        }
        if (!data || data.length === 0) break;
        for (const item of data) {
          if (item.name === '.emptyPlaceholder') continue;
          
          const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name;
          if (!item.id && !item.metadata) {
            // It is a directory, traverse recursively
            const subFiles = await listAllFiles(bucketId, itemPath);
            files.push(...subFiles);
          } else {
            // It is a file
            files.push({
              name: item.name,
              path: itemPath,
              size: item.metadata?.size || 0,
              mimeType: item.metadata?.mimetype
            });
          }
        }
        if (data.length < limit) break;
        offset += limit;
      }
      return files;
    }

    // Process each bucket
    for (const bucket of buckets) {
      const bName = bucket.name;
      console.log(`Processing bucket: ${bName}`);
      
      const bucketMeta = {
        name: bName,
        id: bucket.id,
        public: bucket.public,
        files_count: 0,
        bytes_count: 0
      };

      const files = await listAllFiles(bucket.id);
      console.log(`  Found ${files.length} files in bucket '${bName}'`);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const localPath = path.join(STORAGE_DIR, bName, file.path);
        
        // Skip if file already exists with the correct size
        if (fs.existsSync(localPath)) {
          try {
            const stats = fs.statSync(localPath);
            if (stats.size === file.size) {
              console.log(`  [${i + 1}/${files.length}] Skipping (already downloaded): ${file.path}`);
              bucketMeta.files_count++;
              bucketMeta.bytes_count += file.size;
              metadata.storage.total_files++;
              metadata.storage.total_bytes += file.size;
              continue;
            }
          } catch (err) {
            // Ignore error and proceed to download
          }
        }
        
        console.log(`  [${i + 1}/${files.length}] Downloading: ${file.path} (${(file.size / 1024).toFixed(1)} KB)`);
        
        try {
          const { data: blob, error: dErr } = await supabase.storage.from(bucket.id).download(file.path);
          if (dErr) {
            console.error(`  Failed to download file '${file.path}':`, dErr.message);
            continue;
          }
          
          const arrayBuffer = await blob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          fs.mkdirSync(path.dirname(localPath), { recursive: true });
          fs.writeFileSync(localPath, buffer);
          
          bucketMeta.files_count++;
          bucketMeta.bytes_count += file.size;
          metadata.storage.total_files++;
          metadata.storage.total_bytes += file.size;
        } catch (err) {
          console.error(`  Exception downloading file '${file.path}':`, err.message);
        }
      }

      metadata.storage.buckets.push(bucketMeta);
    }

    metadata.status = 'SUCCESS';
    console.log('\n=== Backup Completed Successfully! ===');

  } catch (err) {
    console.error('\n!!! Backup Failed !!!');
    console.error(err);
    metadata.status = 'FAILED';
    metadata.error = err.message;
  } finally {
    // Write metadata
    fs.writeFileSync(
      path.join(BACKUP_DIR, 'backup-metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf8'
    );
    console.log(`Metadata written to ${path.join(BACKUP_DIR, 'backup-metadata.json')}`);
    dbPool.end();
  }
}

runBackup();
