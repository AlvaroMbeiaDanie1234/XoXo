import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createUsers() {
  const credentials = [
    { email: 'admin.xoxo@gmail.com', password: 'xoxo12345678', display_name: 'Admin XoXo' },
    { email: 'superadmin.xoxo@gmail.com', password: 'xoxo12345678', display_name: 'Super Admin XoXo' }
  ];

  for (const cred of credentials) {
    console.log(`Creating user: ${cred.email}...`);
    
    // Try creating with admin.createUser to auto-confirm email
    const { data, error } = await supabase.auth.admin.createUser({
      email: cred.email,
      password: cred.password,
      email_confirm: true,
      user_metadata: { display_name: cred.display_name }
    });

    if (error) {
      console.log(`Error creating ${cred.email}: ${error.message}`);
      // If user already registered, update their password using admin tools
      console.log(`Let's attempt to update the password to ensure it is correct...`);
      try {
        const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;
        
        const existingUser = listData.users.find(u => u.email === cred.email);
        if (existingUser) {
          const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
            password: cred.password,
            email_confirm: true
          });
          if (updateError) throw updateError;
          console.log(`Password updated successfully for ${cred.email}!`);
          
          // Also ensure profile exists
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: existingUser.id,
              display_name: cred.display_name,
              email: cred.email,
              is_free_plan: true
            });
          if (profileError) console.error(`Error upserting profile: ${profileError.message}`);
        } else {
          console.log(`Could not find existing user in listed users.`);
        }
      } catch (err) {
        console.error(`Failed to update existing user ${cred.email}:`, err.message);
      }
    } else {
      console.log(`User ${cred.email} created successfully with ID: ${data.user.id}`);
      
      // Upsert profile entry
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          display_name: cred.display_name,
          email: cred.email,
          is_free_plan: true
        });
      
      if (profileError) {
        console.error(`Error upserting profile for ${cred.email}:`, profileError.message);
      } else {
        console.log(`Profile created/updated for ${cred.email}!`);
      }
    }
  }
}

createUsers();
