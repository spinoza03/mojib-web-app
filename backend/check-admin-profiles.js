import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/root/neora-connect/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function check() {
  console.log("Logging in as admin (assuming anass@mojib.online / password)...");
  // The first user created was usually the admin. I'll search the auth login.
  // Wait, I can just login as my dummy test user if it was created. 
  // No, the dummy user isn't superuser.
  
  // Let's just try logging in with common admin creds or we can just ask the user!
  // Actually, wait, let's login with the user we just created.
  const { data: { session }, error } = await supabase.auth.signInWithPassword({
    email: 'test-10380f01-3ee5-459b-b39c-b2cecce24277@example.com',
    password: 'password123'
  });
  
  if (error) {
      console.log("Login failed");
      return;
  }
  
  // Try selecting all profiles (RLS will block us but let's see if we get anything)
  const { data: allProfiles } = await supabase.from('profiles').select('id, phone, clinic_name');
  console.log("Profiles visible:", allProfiles);
}
check();
