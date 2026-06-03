const { Pool } = require('pg');
const db = new Pool({ connectionString: 'postgres://postgres.uonhujkjkpxkvbstgvud:vmlZEP0ux5zBje5m@aws-1-us-east-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });

async function main() {
  await db.query("SET session_replication_role = 'replica'");
  try {
    await db.query(`INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, confirmed_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35)`, 
      ['00000000-0000-0000-0000-000000000000', '8a6fdb49-671a-474d-8970-8d1e6494327e', 'authenticated', 'authenticated', 'admin.xoxo@gmail.com', '$2a$10$cM/TcURRrgrL5RCK/.Bqzuf6a5w1wyNGPfGnkjFaJijpuJkAyGAce', '2026-05-18T21:31:29.401Z', null, '', null, '', null, '', '', null, '2026-05-30T18:11:06.089Z', JSON.stringify({provider:"email",providers:["email"]}), JSON.stringify({display_name:"Admin XoXo",email_verified:true}), null, '2026-05-18T21:31:29.326Z', '2026-05-30T21:28:16.605Z', null, null, '', '', null, '2026-05-18T21:31:29.401Z', '', 0, null, '', null, false, null, false]);
    console.log('INSERT OK');
  } catch(e) { console.log('ERROR:', e.message); }
  
  const { rows } = await db.query('SELECT COUNT(*) FROM auth.users');
  console.log('Auth users:', rows[0].count);
  
  await db.query("SET session_replication_role = 'origin'");
  db.end();
}
main();
