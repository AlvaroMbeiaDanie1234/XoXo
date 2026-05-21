import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  const userId = '24de0a38-fecf-4532-acf4-2c041803c3bc'; // Xuxuda's ID
  
  console.log('Querying profiles table for user ID:', userId);
  
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, balance')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Supabase Query Error:', error);
  } else {
    console.log('Supabase Query Result:', data);
  }
}

testQuery();
