const { Pool } = require('pg');
const fs = require('fs');

const OLD = new Pool({ connectionString: 'postgres://postgres.vuyscgfbwhmqydeznphi:qx7AqA2PmiwZuubI@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });

async function main() {
  // Get all user tables
  const { rows: tables } = await OLD.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('schema_migrations', '_prisma_migrations') ORDER BY tablename`
  );

  const output = [];
  output.push('-- ============================================================');
  output.push('-- FULL BACKUP - Generated ' + new Date().toISOString());
  output.push('-- ============================================================');
  output.push('');

  // 1. Dump SCHEMA (CREATE TABLE + indexes + sequences)
  for (const t of tables) {
    const tbl = t.tablename;
    const { rows: ddl } = await OLD.query(
      `SELECT pg_catalog.pg_get_viewdef('"${tbl}"'::regclass, true) AS view_def, 
              pg_catalog.pg_get_viewdef('"${tbl}"'::regclass) AS view_def_std`
    );
    const viewDef = ddl[0]?.view_def;

    if (viewDef) {
      // It's a view
      const { rows: cols } = await OLD.query(
        `SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) AS cols
         FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        [tbl]
      );
      output.push(`CREATE OR REPLACE VIEW public."${tbl}" AS ${viewDef};`);
    } else {
      // Regular table - get CREATE TABLE
      const { rows: [def] } = await OLD.query(
        `SELECT pg_catalog.pg_get_viewdef('"${tbl}"'::regclass)`
      );
      // Use information_schema to build CREATE TABLE
      const { rows: columns } = await OLD.query(
        `SELECT column_name, is_nullable, data_type, character_maximum_length, column_default,
                udt_name
         FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [tbl]
      );

      // Get primary key
      const { rows: pk } = await OLD.query(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
         WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'`,
        [tbl]
      );

      // Get indexes
      const { rows: indexes } = await OLD.query(
        `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1 AND indexname NOT LIKE '%_pkey'`,
        [tbl]
      );

      // Get sequences
      const { rows: sequences } = await OLD.query(
        `SELECT pg_get_serial_sequence('"${tbl}"', column_name) AS seq
         FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = $1 
           AND column_default LIKE 'nextval%'`,
        [tbl]
      );

      // Build CREATE TABLE
      let sql = `CREATE TABLE IF NOT EXISTS public."${tbl}" (\n`;
      const colDefs = columns.map(c => {
        let type = c.data_type;
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

        let def = `    "${c.column_name}" ${type}`;
        if (c.is_nullable === 'NO') def += ' NOT NULL';
        if (c.column_default) {
          let dflt = c.column_default;
          // Clean up nextval references
          if (dflt.includes('nextval')) {
            const m = dflt.match(/'([^']+)'/);
            if (m) dflt = `nextval('${m[1]}'::regclass)`;
          }
          def += ` DEFAULT ${dflt}`;
        }
        return def;
      });
      sql += colDefs.join(',\n');
      
      // Add PK
      if (pk.length > 0) {
        sql += `,\n    PRIMARY KEY (${pk.map(p => `"${p.column_name}"`).join(', ')})`;
      }
      sql += '\n);';
      output.push(sql);

      // Add indexes
      for (const idx of indexes) {
        output.push(idx.indexdef.replace(/^CREATE /, 'CREATE IF NOT EXISTS ').replace(/ ON ONLY /, ' ON ') + ';');
      }

      // Set sequence values
      for (const seq of sequences) {
        if (seq.seq) {
          const seqName = seq.seq.split('.')[1].replace(/"/g, '');
          output.push(`SELECT pg_catalog.setval('"${seqName}"', COALESCE((SELECT MAX(id) FROM "${tbl}"), 1), false);`);
        }
      }
    }
    output.push('');
  }

  // 2. Dump DATA
  for (const t of tables) {
    const tbl = t.tablename;
    try {
      // Check if it's a view first
      const { rows: [check] } = await OLD.query(
        `SELECT table_type FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        [tbl]
      );
      if (check?.table_type === 'VIEW') continue;

      const { rows: data } = await OLD.query(`SELECT * FROM "${tbl}" ORDER BY 1`);
      if (data.length === 0) continue;

      const cols = Object.keys(data[0]);
      const quotedCols = cols.map(c => `"${c}"`).join(', ');

      // Batch insert
      const batchSize = 100;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const values = batch.map(row => {
          return '(' + cols.map(c => {
            const v = row[c];
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'number') return v.toString();
            if (typeof v === 'boolean') return v ? 'true' : 'false';
            if (v instanceof Date) return `'${v.toISOString()}'`;
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
            return `'${String(v).replace(/'/g, "''")}'`;
          }).join(', ') + ')';
        }).join(',\n');

        output.push(`INSERT INTO public."${tbl}" (${quotedCols}) VALUES \n${values};`);
      }
      output.push('');
    } catch (e) {
      output.push(`-- Skipping ${tbl}: ${e.message}`);
    }
  }

  // 3. Rebuild sequences
  for (const t of tables) {
    const tbl = t.tablename;
    try {
      const { rows: cols } = await OLD.query(
        `SELECT column_name, column_default FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = $1 AND column_default LIKE '%nextval%'`,
        [tbl]
      );
      for (const c of cols) {
        const m = c.column_default.match(/'([^']+)'/);
        if (m) {
          output.push(`SELECT pg_catalog.setval('${m[1]}', COALESCE((SELECT MAX("${c.column_name}") FROM "${tbl}"), 1), false);`);
        }
      }
    } catch (e) {}
  }

  // 4. Dump auth schema tables if any
  const { rows: authTables } = await OLD.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'auth' ORDER BY tablename`
  );
  if (authTables.length > 0) {
    output.push('\n-- AUTH SCHEMA');
    for (const t of authTables) {
      const tbl = t.tablename;
      // Only include users
      if (tbl === 'users') {
        try {
          const { rows: data } = await OLD.query(`SELECT * FROM auth."${tbl}" ORDER BY 1`);
          if (data.length > 0) {
            const cols = Object.keys(data[0]);
            const quotedCols = cols.map(c => `"${c}"`).join(', ');
            const values = data.map(row => {
              return '(' + cols.map(c => {
                const v = row[c];
                if (v === null || v === undefined) return 'NULL';
                if (typeof v === 'number') return v.toString();
                if (typeof v === 'boolean') return v ? 'true' : 'false';
                if (v instanceof Date) return `'${v.toISOString()}'`;
                if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
                return `'${String(v).replace(/'/g, "''")}'`;
              }).join(', ') + ')';
            }).join(',\n');
            output.push(`-- INSERT INTO auth."${tbl}" (${quotedCols}) VALUES ... (${data.length} rows) (handled by Supabase Auth)`);
          }
        } catch (e) {}
      }
    }
  }

  fs.writeFileSync('backup.sql', output.join('\n'), 'utf8');
  console.log('Backup written to backup.sql (' + (fs.statSync('backup.sql').size / 1024 / 1024).toFixed(2) + ' MB)');
}
main().catch(e => { console.error('ERR:', e); process.exit(1) }).then(() => OLD.end());
