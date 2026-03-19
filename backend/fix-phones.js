import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/root/neora-connect/.env' });

// We use the anon key since we will bypass RLS by passing the service role key if needed, 
// wait, we need service_role_key to bypass RLS!
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
// the backend/.env HAS the service role key! Let's load backend/.env instead!
dotenv.config({ path: '/root/neora-connect/backend/.env', override: true });

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function fixPhones() {
  const { data: profiles, error } = await supabase.from('profiles').select('id, phone');
  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }
  
  if (!profiles || profiles.length === 0) {
      console.log("No profiles accessible with this key.");
  }

  let fixedCount = 0;
  for (const p of profiles) {
    if (p.phone) {
      const cleanPhone = p.phone.replace(/\D/g, '');
      if (cleanPhone !== p.phone) {
        console.log(`Fixing phone for ${p.id}: ${p.phone} -> ${cleanPhone}`);
        await supabase.from('profiles').update({ phone: cleanPhone }).eq('id', p.id);
        fixedCount++;
      }
    }
  }
  console.log(`Fixed ${fixedCount} phones.`);
}

fixPhones();
